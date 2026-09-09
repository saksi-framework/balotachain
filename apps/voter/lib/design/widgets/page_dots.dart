import 'package:flutter/material.dart';
import '../tokens.dart';

/// Onboarding pagination. Mirrors the mockup `PageDots`: 8px pills that stretch
/// to 22px and turn teal when active.
class BcPageDots extends StatelessWidget {
  const BcPageDots({super.key, required this.count, required this.current});

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: List<Widget>.generate(count, (i) {
        final active = i == current;
        return Padding(
          padding: EdgeInsets.only(left: i == 0 ? 0 : BcSpace.xs),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
            width: active ? 22 : 8,
            height: 8,
            decoration: BoxDecoration(
              color: active ? BcColors.teal : BcColors.border,
              borderRadius: BorderRadius.circular(BcRadii.pill),
            ),
          ),
        );
      }),
    );
  }
}
