import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voter/design/design.dart';

Widget _host(Widget child) =>
    MaterialApp(home: Scaffold(body: Center(child: child)));

void main() {
  group('bcInitials', () {
    test('takes the first and last word', () {
      expect(bcInitials('Andrea Reyes'), 'AR');
      expect(bcInitials('Joy delos Santos'), 'JS');
    });

    test('falls back to two letters for a single word', () {
      expect(bcInitials('Lapu-Lapu'), 'LA');
    });

    test('returns empty for a blank name', () {
      expect(bcInitials('   '), '');
    });
  });

  group('BcPrimaryButton', () {
    testWidgets('fires onPressed when enabled', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(BcPrimaryButton(label: 'Next', onPressed: () => taps++)),
      );
      await tester.tap(find.text('Next'));
      expect(taps, 1);
    });

    testWidgets('does nothing when disabled', (tester) async {
      await tester.pumpWidget(
        _host(const BcPrimaryButton(label: 'Next', onPressed: null)),
      );
      await tester.tap(find.text('Next'), warnIfMissed: false);
      // No callback to assert on; the test passes if the tap does not throw.
      expect(find.text('Next'), findsOneWidget);
    });
  });

  group('BcOptionCard', () {
    testWidgets('renders initials, name and role, and reports taps', (
      tester,
    ) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(
          BcOptionCard(
            label: 'Maria Santos',
            description: 'Lakas-CMD',
            selected: false,
            onTap: () => taps++,
          ),
        ),
      );

      expect(find.text('MS'), findsOneWidget);
      expect(find.text('Maria Santos'), findsOneWidget);
      expect(find.text('Lakas-CMD'), findsOneWidget);

      await tester.tap(find.text('Maria Santos'));
      expect(taps, 1);
    });

    testWidgets('a disabled card swallows taps', (tester) async {
      var taps = 0;
      await tester.pumpWidget(
        _host(
          BcOptionCard(
            label: 'Maria Santos',
            selected: false,
            disabled: true,
            onTap: () => taps++,
          ),
        ),
      );
      await tester.tap(find.text('Maria Santos'), warnIfMissed: false);
      expect(taps, 0);
    });
  });

  testWidgets('BcPageDots renders one dot per page', (tester) async {
    await tester.pumpWidget(_host(const BcPageDots(count: 3, current: 1)));
    expect(
      find.descendant(
        of: find.byType(BcPageDots),
        matching: find.byType(AnimatedContainer),
      ),
      findsNWidgets(3),
    );
  });

  testWidgets('BcTextInput shows its label and helper', (tester) async {
    final controller = TextEditingController();
    addTearDown(controller.dispose);
    await tester.pumpWidget(
      _host(
        BcTextInput(
          controller: controller,
          label: 'Email address',
          helper: 'Used to identify your ballot.',
        ),
      ),
    );
    expect(find.text('Email address'), findsOneWidget);
    expect(find.text('Used to identify your ballot.'), findsOneWidget);
  });
}
