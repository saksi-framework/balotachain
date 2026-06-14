// File-backed bulletin store adapter for the voter app.
//
// Mirrors the schema served by `crates/bulletin-store` (Rust). The voter app
// reads this directly so it can render election + credential state and detect
// freshly-submitted ballots written by the `balota-encrypt` CLI.

import 'dart:convert';
import 'dart:io';

class BulletinStore {
  BulletinStore(this.file);

  /// Resolves to `$HOME/.balotachain/bulletin.json`, matching the Rust
  /// `default_path()` so both ends agree on a single file.
  factory BulletinStore.atDefaultPath() {
    final home = Platform.environment['HOME'] ?? '';
    return BulletinStore(File('$home/.balotachain/bulletin.json'));
  }

  final File file;

  /// Empty default that matches `Bulletin::empty()` in the Rust crate.
  static Map<String, dynamic> emptyDefault() => <String, dynamic>{
        'version': 1,
        'election': null,
        'voters': <dynamic>[],
        'credentials': <dynamic>[],
        'ballots': <dynamic>[],
        'partial_decryptions': <dynamic>[],
        'tally': null,
      };

  /// Reads the bulletin from disk. Returns the empty default if the file is
  /// missing or empty.
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
  Future<void> save(Map<String, dynamic> data) async {
    final parent = file.parent;
    if (!await parent.exists()) {
      await parent.create(recursive: true);
    }
    const encoder = JsonEncoder.withIndent('  ');
    await file.writeAsString(encoder.convert(data));
  }
}
