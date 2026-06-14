// TDD: written before the implementation.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:voter/services/encrypt_service.dart';

class _RecordingRunner implements ProcessRunner {
  _RecordingRunner(this._result);

  final ProcessResult _result;
  String? lastExecutable;
  List<String>? lastArgs;

  @override
  Future<ProcessResult> run(String executable, List<String> args) async {
    lastExecutable = executable;
    lastArgs = args;
    return _result;
  }
}

ProcessResult _ok(Map<String, dynamic> body) =>
    ProcessResult(0, 0, jsonEncode(body), '');

ProcessResult _err(String msg, {int code = 1}) =>
    ProcessResult(0, code, jsonEncode({'error': msg}), '');

void main() {
  group('EncryptService.submitBallot', () {
    test('shells out with the expected argv', () async {
      final runner = _RecordingRunner(_ok({
        'tracking_code': 'BC-1234-5678',
        'submitted_at': '2026-06-14T10:00:00+00:00',
      }));
      final svc = EncryptService(
        binaryPath: '/usr/local/bin/balota-encrypt',
        runner: runner,
      );
      final result = await svc.submitBallot(
        voterId: 'v-000001',
        token: 'cd' * 16,
        choice: 0x010203,
      );
      expect(runner.lastExecutable, '/usr/local/bin/balota-encrypt');
      expect(runner.lastArgs, [
        'submit-ballot',
        '--voter-id',
        'v-000001',
        '--token',
        'cd' * 16,
        '--choice',
        '66051', // 0x010203 in decimal
      ]);
      expect(result.trackingCode, 'BC-1234-5678');
      expect(result.submittedAt, '2026-06-14T10:00:00+00:00');
    });

    test('throws EncryptServiceException on non-zero exit', () async {
      final runner = _RecordingRunner(_err('no election in bulletin'));
      final svc = EncryptService(runner: runner);
      await expectLater(
        svc.submitBallot(
          voterId: 'v-000001',
          token: 'cd' * 16,
          choice: 1,
        ),
        throwsA(
          isA<EncryptServiceException>().having(
            (e) => e.message,
            'message',
            contains('no election'),
          ),
        ),
      );
    });

    test('throws when stdout is not JSON', () async {
      final runner = _RecordingRunner(ProcessResult(0, 0, 'not json at all', ''));
      final svc = EncryptService(runner: runner);
      await expectLater(
        svc.submitBallot(
          voterId: 'v-000001',
          token: 'cd' * 16,
          choice: 1,
        ),
        throwsA(isA<EncryptServiceException>()),
      );
    });
  });

  group('packChoice', () {
    test('packs president, vp, senator count into a single u32', () {
      expect(packChoice(presidentIndex: 1, vpIndex: 2, senatorCount: 3),
          0x010203);
      expect(packChoice(presidentIndex: 0, vpIndex: 0, senatorCount: 0), 0);
      expect(packChoice(presidentIndex: 0xFF, vpIndex: 0xFF, senatorCount: 0xFF),
          0xFFFFFF);
    });
  });
}
