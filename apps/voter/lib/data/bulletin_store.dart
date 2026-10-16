// Bulletin store adapters for the voter app.
//
// Mirrors the schema served by `crates/bulletin-store` (Rust). Two backends:
//   - `BulletinStore`     — local `$HOME/.balotachain/bulletin.json` file.
//   - `HttpBulletinStore` — the containerized `bulletin-gateway` over HTTP.
// `bulletinSourceFromEnv()` picks the gateway when `BALOTA_BULLETIN_URL` is set,
// otherwise the file — so the voter app works the same on any machine. (The
// ballot *write* path goes through the `balota-encrypt` CLI, which makes the same
// choice via its own `BALOTA_BULLETIN_URL` env, inherited from this process.)

import 'dart:convert';
import 'dart:io';

/// Common interface so screens can read/write the bulletin without caring
/// whether the backend is a local file or the gateway.
abstract class BulletinSource {
  Future<Map<String, dynamic>> load();
  Future<void> save(Map<String, dynamic> data);
}

/// Empty default that matches `Bulletin::empty()` in the Rust crate.
Map<String, dynamic> emptyBulletin() => <String, dynamic>{
      'version': 1,
      'election': null,
      'voters': <dynamic>[],
      'credentials': <dynamic>[],
      'ballots': <dynamic>[],
      'partial_decryptions': <dynamic>[],
      'tally': null,
    };

/// Selects the backend from the environment: the gateway if `BALOTA_BULLETIN_URL`
/// is set (and non-empty), otherwise the local file at the default path.
BulletinSource bulletinSourceFromEnv() {
  final base = bulletinBaseUrl();
  return base != null ? HttpBulletinStore(base) : BulletinStore.atDefaultPath();
}

/// `BALOTA_BULLETIN_URL` without trailing slashes, or null when unset. A
/// `--dart-define` wins over the process environment, because a phone build
/// has no shell environment to inherit.
String? bulletinBaseUrl() {
  const defined = String.fromEnvironment('BALOTA_BULLETIN_URL');
  final url = defined.isNotEmpty
      ? defined
      : (Platform.environment['BALOTA_BULLETIN_URL'] ?? '');
  if (url.trim().isEmpty) return null;
  return url.trim().replaceAll(RegExp(r'/+$'), '');
}

/// File-backed bulletin store. Reads/writes a single JSON file shared with the
/// Rust `bulletin-store` crate.
class BulletinStore implements BulletinSource {
  BulletinStore(this.file);

  /// Resolves to `$HOME/.balotachain/bulletin.json`, matching the Rust
  /// `default_path()` so both ends agree on a single file.
  factory BulletinStore.atDefaultPath() {
    final home = Platform.environment['HOME'] ?? '';
    return BulletinStore(File('$home/.balotachain/bulletin.json'));
  }

  final File file;

  /// Empty default that matches `Bulletin::empty()` in the Rust crate.
  static Map<String, dynamic> emptyDefault() => emptyBulletin();

  /// Reads the bulletin from disk. Returns the empty default if the file is
  /// missing or empty.
  @override
  Future<Map<String, dynamic>> load() async {
    if (!await file.exists()) {
      return emptyDefault();
    }
    final body = await file.readAsString();
    if (body.trim().isEmpty) {
      return emptyDefault();
    }
    return jsonDecode(body) as Map<String, dynamic>;
  }

  /// Pretty-prints + writes the bulletin to disk, creating parent directories
  /// as needed.
  @override
  Future<void> save(Map<String, dynamic> data) async {
    final parent = file.parent;
    if (!await parent.exists()) {
      await parent.create(recursive: true);
    }
    const encoder = JsonEncoder.withIndent('  ');
    await file.writeAsString(encoder.convert(data));
  }
}

/// Gateway-backed bulletin store. Talks to the `bulletin-gateway` container at
/// `baseUrl` (no trailing slash), matching its `GET`/`PUT /bulletin` contract.
class HttpBulletinStore implements BulletinSource {
  HttpBulletinStore(this.baseUrl, {HttpClient? client}) : _client = client;

  final String baseUrl;
  final HttpClient? _client;

  @override
  Future<Map<String, dynamic>> load() async {
    final client = _client ?? HttpClient();
    try {
      final req = await client.getUrl(Uri.parse('$baseUrl/bulletin'));
      final resp = await req.close();
      final body = await resp.transform(utf8.decoder).join();
      if (resp.statusCode != 200) {
        throw HttpException('gateway GET /bulletin failed: ${resp.statusCode}');
      }
      if (body.trim().isEmpty) {
        return emptyBulletin();
      }
      return jsonDecode(body) as Map<String, dynamic>;
    } finally {
      if (_client == null) client.close();
    }
  }

  /// Checks one tracking code against a run's ballot records on the
  /// saksi-campaign console: `GET /api/verify-code/<run>/<code>`
  /// (`handleVerifyCode` in saksi `packages/saksi-campaign/board.go`). Same
  /// handling as the board's `verifyTrackingCode`
  /// (`apps/auditor/src/lib/bulletin.ts`): 409 is ambiguous, 200 with
  /// `found: false` is missing. Unlike the board, a failure is returned as
  /// [VerifyCodeKind.error] rather than thrown, so the screen never crashes.
  Future<VerifyCodeResult> verifyCode(
    String runId,
    String code, {
    Duration timeout = const Duration(seconds: 10),
  }) async {
    final client = _client ?? (HttpClient()..connectionTimeout = timeout);
    try {
      final uri = Uri.parse(
        '$baseUrl/api/verify-code/'
        '${Uri.encodeComponent(runId)}/${Uri.encodeComponent(code)}',
      );
      final req = await client.getUrl(uri).timeout(timeout);
      req.headers.set(HttpHeaders.acceptHeader, 'application/json');
      final resp = await req.close().timeout(timeout);
      final body = await resp.transform(utf8.decoder).join().timeout(timeout);
      if (resp.statusCode == 409) {
        return const VerifyCodeResult(VerifyCodeKind.ambiguous);
      }
      if (resp.statusCode != 200) {
        return VerifyCodeResult(
          VerifyCodeKind.error,
          message: 'verify-code returned ${resp.statusCode}: ${body.trim()}',
        );
      }
      final record =
          VerifyCodeRecord.fromJson(jsonDecode(body) as Map<String, dynamic>);
      return record.found
          ? VerifyCodeResult(VerifyCodeKind.found, record: record)
          : const VerifyCodeResult(VerifyCodeKind.missing);
    } catch (e) {
      return VerifyCodeResult(VerifyCodeKind.error, message: e.toString());
    } finally {
      if (_client == null) client.close(force: true);
    }
  }

  @override
  Future<void> save(Map<String, dynamic> data) async {
    final client = _client ?? HttpClient();
    try {
      final req = await client.putUrl(Uri.parse('$baseUrl/bulletin'));
      req.headers.contentType = ContentType.json;
      req.add(utf8.encode(jsonEncode(data)));
      final resp = await req.close();
      await resp.drain<void>();
      if (resp.statusCode != 200) {
        throw HttpException('gateway PUT /bulletin failed: ${resp.statusCode}');
      }
    } finally {
      if (_client == null) client.close();
    }
  }
}

/// Outcome of a tracking-code lookup. Mirrors the board's `VerifyOutcome`
/// (found / missing / ambiguous), plus `error` for network or server failure.
/// An 8-hex prefix is 32 bits, so two records can share one; the console
/// refuses that case (409) rather than show someone else's record.
enum VerifyCodeKind { found, missing, ambiguous, error }

class VerifyCodeResult {
  const VerifyCodeResult(this.kind, {this.record, this.message = ''});

  final VerifyCodeKind kind;
  final VerifyCodeRecord? record;
  final String message;
}

/// The console's `VerifyCodeResponse` (board's `BallotRecord`). One tracking
/// code is one ballot record: one position (contest) of one voter. Nothing in
/// it reveals a selection.
class VerifyCodeRecord {
  const VerifyCodeRecord({
    required this.found,
    required this.trackingCode,
    required this.ballotIndex,
    required this.committedOnChain,
    this.positionId,
    this.positionLabel,
    this.nullifier,
    this.ballotSha256,
    this.recordedAt,
    this.blockNumber,
    this.txId,
  });

  factory VerifyCodeRecord.fromJson(Map<String, dynamic> j) => VerifyCodeRecord(
        found: j['found'] == true,
        trackingCode: (j['tracking_code'] as String?) ?? '',
        ballotIndex: (j['ballot_index'] as num?)?.toInt() ?? 0,
        committedOnChain: j['committed_on_chain'] == true,
        positionId: j['position_id'] as String?,
        positionLabel: j['position_label'] as String?,
        nullifier: j['nullifier'] as String?,
        ballotSha256: j['ballot_sha256'] as String?,
        recordedAt: DateTime.tryParse((j['recorded_at'] as String?) ?? ''),
        blockNumber: (j['block_number'] as num?)?.toInt(),
        txId: j['tx_id'] as String?,
      );

  final bool found;
  final String trackingCode;
  final int ballotIndex;
  final bool committedOnChain;
  final String? positionId;
  final String? positionLabel;
  final String? nullifier;
  final String? ballotSha256;
  final DateTime? recordedAt;
  final int? blockNumber;
  final String? txId;
}
