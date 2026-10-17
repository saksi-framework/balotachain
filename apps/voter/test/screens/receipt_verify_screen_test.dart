import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voter/data/bulletin_store.dart';
import 'package:voter/screens/receipt_verify_screen.dart';
import 'package:voter/screens/verification_screen.dart';

void main() {
  testWidgets('shows the found card for a code on the board', (tester) async {
    String? askedRun;
    String? askedCode;
    await tester.pumpWidget(
      MaterialApp(
        home: ReceiptVerifyScreen(
          initialRunId: 'demo-run',
          initialCode: 'BC-1A2B-3C4D',
          verify: (run, code) async {
            askedRun = run;
            askedCode = code;
            return const VerifyCodeResult(
              VerifyCodeKind.found,
              record: VerifyCodeRecord(
                found: true,
                trackingCode: 'BC-1A2B-3C4D',
                ballotIndex: 7,
                committedOnChain: true,
                positionLabel: 'President',
                blockNumber: 42,
              ),
            );
          },
        ),
      ),
    );
    expect(find.text('Public board'), findsOneWidget);

    await tester.tap(find.text('Verify'));
    await tester.pumpAndSettle();

    expect(askedRun, 'demo-run');
    expect(askedCode, 'BC-1A2B-3C4D');
    expect(
      find.text('Ballot record found on the public board'),
      findsOneWidget,
    );
    expect(find.text('President'), findsOneWidget);
    expect(find.text('Committed, block 42'), findsOneWidget);
  });

  testWidgets('shows the not-found notice', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: ReceiptVerifyScreen(
          initialRunId: 'demo-run',
          initialCode: 'BC-0000-0000',
          verify: (_, _) async =>
              const VerifyCodeResult(VerifyCodeKind.missing),
        ),
      ),
    );
    await tester.tap(find.text('Verify'));
    await tester.pumpAndSettle();
    expect(find.textContaining('No ballot record'), findsOneWidget);
  });

  testWidgets('verification screen opens the public board check', (
    tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(home: VerificationScreen(initialCode: 'BC-1A2B-3C4D')),
    );
    await tester.ensureVisible(find.text('Verify on the public board'));
    await tester.tap(find.text('Verify on the public board'));
    await tester.pumpAndSettle();
    expect(find.byType(ReceiptVerifyScreen), findsOneWidget);
  });
}
