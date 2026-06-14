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
  final url = Platform.environment['BALOTA_BULLETIN_URL'];
  if (url != null && url.trim().isNotEmpty) {
    final base = url.trim().replaceAll(RegExp(r'/+$'), '');
    return HttpBulletinStore(base);
  }
  return BulletinStore.atDefaultPath();
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
