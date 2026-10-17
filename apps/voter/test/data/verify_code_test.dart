// HttpBulletinStore.verifyCode against a local fake console, covering the
// response cases of saksi `handleVerifyCode` (board.go): found (200,
// found=true), not found (200, found=false), ambiguous (409), a server error,
// and an unreachable console. None of them may throw.

import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:voter/data/bulletin_store.dart';

void main() {
  late HttpServer server;
  late String baseUrl;
  late int status;
  late String body;
  late String lastPath;

  setUp(() async {
    status = 200;
    body = '{}';
    server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    baseUrl = 'http://127.0.0.1:${server.port}';
    unawaited(() async {
      await for (final req in server) {
        lastPath = req.uri.path;
        req.response.statusCode = status;
        req.response.headers.contentType = ContentType.json;
        req.response.write(body);
        await req.response.close();
      }
    }());
  });

  tearDown(() async => server.close(force: true));

  test('found record is parsed', () async {
    body = jsonEncode({
      'found': true,
      'tracking_code': 'BC-1A2B-3C4D',
      'ballot_index': 7,
      'position_id': 'pres',
      'position_label': 'President',
      'nullifier': '1a2b3c4d${'ee' * 28}',
      'ballot_sha256': 'ab' * 32,
      'recorded_at': '2026-10-17T08:00:00Z',
      'block_number': 42,
      'tx_id': 'tx-abc',
      'committed_on_chain': true,
    });
    final r = await HttpBulletinStore(
      baseUrl,
    ).verifyCode('run 1', 'BC-1A2B-3C4D');
    expect(lastPath, '/api/verify-code/run%201/BC-1A2B-3C4D');
    expect(r.kind, VerifyCodeKind.found);
    expect(r.record!.trackingCode, 'BC-1A2B-3C4D');
    expect(r.record!.positionLabel, 'President');
    expect(r.record!.ballotIndex, 7);
    expect(r.record!.blockNumber, 42);
    expect(r.record!.committedOnChain, isTrue);
    expect(r.record!.recordedAt, DateTime.utc(2026, 10, 17, 8));
  });

  test('found=false is not found', () async {
    body = jsonEncode({
      'found': false,
      'tracking_code': '',
      'ballot_index': 0,
      'committed_on_chain': false,
    });
    final r = await HttpBulletinStore(baseUrl).verifyCode('r', 'BC-0000-0000');
    expect(r.kind, VerifyCodeKind.missing);
    expect(r.record, isNull);
  });

  test('409 is ambiguous', () async {
    status = 409;
    body = jsonEncode({'error': 'matches more than one'});
    final r = await HttpBulletinStore(baseUrl).verifyCode('r', 'BC-0000-0000');
    expect(r.kind, VerifyCodeKind.ambiguous);
  });

  test('server error is reported, not thrown', () async {
    status = 400;
    body = 'tracking codes look like BC-XXXX-XXXX, with hex digits\n';
    final r = await HttpBulletinStore(baseUrl).verifyCode('r', 'nope');
    expect(r.kind, VerifyCodeKind.error);
    expect(r.message, contains('400'));
    expect(r.message, contains('BC-XXXX-XXXX'));
  });

  test('unreachable console is reported, not thrown', () async {
    await server.close(force: true);
    final r = await HttpBulletinStore(baseUrl).verifyCode('r', 'BC-0000-0000');
    expect(r.kind, VerifyCodeKind.error);
    expect(r.message, isNotEmpty);
  });
}
