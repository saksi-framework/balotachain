// Shells out to the `balota-encrypt` Rust CLI to perform the real Saksi
// ElGamal encrypt + bulletin append. This is a desktop-only path used by the
// staging demo (macOS `flutter run -d macos`). A real `flutter_rust_bridge`
// FFI will replace this for mobile in a later session.

import 'dart:convert';
import 'dart:io';

/// Indirection over `Process.run` so tests can inject a fake.
abstract class ProcessRunner {
  Future<ProcessResult> run(String executable, List<String> args);
}

class _RealProcessRunner implements ProcessRunner {
  const _RealProcessRunner();
  @override
  Future<ProcessResult> run(String executable, List<String> args) =>
      Process.run(executable, args);
}

/// Thrown when the CLI exits non-zero or returns malformed stdout.
class EncryptServiceException implements Exception {
  EncryptServiceException(this.message);
  final String message;
  @override
  String toString() => 'EncryptServiceException: $message';
}

/// Packs the voter's per-position choices into a single u64 the way the
/// staging demo expects. THIS IS A DEMO ENCODING — replace with real per-position
/// ballots once `saksi-ffi` supports batched contests.
///
/// Layout (high to low): `[8 bits president_index][8 bits vp_index][8 bits senator_count]`.
/// Counts and indices are clamped to `0xFF`. The senator slot is the *count*
/// (not a bitmask) so small-int ElGamal stays comfortably in range.
int packChoice({
  required int presidentIndex,
  required int vpIndex,
  required int senatorCount,
}) {
  final p = presidentIndex & 0xFF;
  final v = vpIndex & 0xFF;
  final s = senatorCount & 0xFF;
  return (p << 16) | (v << 8) | s;
}

class EncryptService {
  EncryptService({
    this.binaryPath = 'balota-encrypt',
    ProcessRunner? runner,
  }) : _runner = runner ?? const _RealProcessRunner();

  /// Path to the `balota-encrypt` binary. Defaults to bare name so the OS
  /// PATH resolves it (e.g. `~/.cargo/bin` after `cargo install`).
  final String binaryPath;
  final ProcessRunner _runner;

  Future<({String trackingCode, String submittedAt})> submitBallot({
    required String voterId,
    required String token,
    required int choice,
  }) async {
    final result = await _runner.run(binaryPath, <String>[
      'submit-ballot',
      '--voter-id',
      voterId,
      '--token',
      token,
      '--choice',
      choice.toString(),
    ]);

    final stdout = (result.stdout as Object?)?.toString() ?? '';
    Map<String, dynamic> payload;
    try {
      payload = jsonDecode(stdout) as Map<String, dynamic>;
    } catch (_) {
      throw EncryptServiceException(
        'malformed stdout (exit ${result.exitCode}): $stdout',
      );
    }

    if (result.exitCode != 0 || payload.containsKey('error')) {
      final msg = payload['error']?.toString() ?? 'exit ${result.exitCode}';
      throw EncryptServiceException(msg);
    }

    final tracking = payload['tracking_code']?.toString();
    final submitted = payload['submitted_at']?.toString();
    if (tracking == null || submitted == null) {
      throw EncryptServiceException('missing fields in payload: $stdout');
    }
    return (trackingCode: tracking, submittedAt: submitted);
  }
}
