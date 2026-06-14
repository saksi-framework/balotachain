import 'package:flutter/material.dart';
import '../tokens.dart';

class BcPageDots extends StatelessWidget {
  const BcPageDots({super.key, required this.count, required this.current});

  final int count;
  final int current;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(count, (i) {
        final active = i == current;
        return Padding(
          padding: EdgeInsets.only(left: i == 0 ? 0 : BcSpace.xs),
          child: Container(
            width: 8,
            height: 8,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? BcColors.teal : BcColors.border,
            ),
          ),
        );
      }),
    );
  }
}
