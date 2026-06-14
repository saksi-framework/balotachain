// TDD: written before the implementation.

import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:voter/data/bulletin_store.dart';

void main() {
  late Directory tempDir;
  late File file;
  late BulletinStore store;

  setUp(() async {
    tempDir = await Directory.systemTemp.createTemp('bulletin_test_');
    file = File('${tempDir.path}/bulletin.json');
    store = BulletinStore(file);
  });

  tearDown(() async {
    if (await tempDir.exists()) {
      await tempDir.delete(recursive: true);
    }
  });

  group('BulletinStore.load', () {
    test('returns empty default when file is missing', () async {
      final data = await store.load();
      expect(data['version'], 1);
      expect(data['election'], isNull);
      expect(data['voters'], isEmpty);
      expect(data['credentials'], isEmpty);
      expect(data['ballots'], isEmpty);
      expect(data['partial_decryptions'], isEmpty);
      expect(data['tally'], isNull);
    });

    test('returns empty default when file is empty', () async {
      await file.writeAsString('');
      final data = await store.load();
      expect(data['version'], 1);
      expect(data['ballots'], isEmpty);
    });

    test('parses existing JSON', () async {
      await file.writeAsString(jsonEncode({
        'version': 1,
        'election': null,
        'voters': [
          {'id': 'v-000001', 'email': 'a@b.com', 'name': 'Demo'},
        ],
        'credentials': [],
        'ballots': [],
        'partial_decryptions': [],
        'tally': null,
      }));
      final data = await store.load();
      final voters = data['voters'] as List<dynamic>;
      expect(voters, hasLength(1));
      expect((voters[0] as Map<String, dynamic>)['id'], 'v-000001');
    });
  });

  group('BulletinStore.save', () {
    test('round-trips data', () async {
      final original = {
        'version': 1,
        'election': null,
        'voters': [
          {'id': 'v-000001', 'email': 'a@b.com', 'name': 'Demo'},
        ],
        'credentials': [],
        'ballots': [],
        'partial_decryptions': [],
        'tally': null,
      };
      await store.save(original);
      final loaded = await store.load();
      expect(loaded, equals(original));
    });

    test('creates parent directory if missing', () async {
      final nested = File('${tempDir.path}/nested/dir/bulletin.json');
      final s = BulletinStore(nested);
      await s.save(<String, dynamic>{'version': 1});
      expect(await nested.exists(), isTrue);
    });
  });
}
