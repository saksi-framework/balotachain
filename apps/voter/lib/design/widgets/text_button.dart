import 'package:flutter/material.dart';
import '../tokens.dart';

/// Borderless link-style action. Mirrors the mockup `TextButton`: teal 16/600
/// with 8px vertical / 4px horizontal padding. `color` overrides the tint
/// (the onboarding "Skip" uses `BcColors.text2`).
class BcTextButton extends StatelessWidget {
  const BcTextButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.color = BcColors.teal,
  });

  final String label;
  final VoidCallback onPressed;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: color,
        backgroundColor: Colors.transparent,
        minimumSize: Size.zero,
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: BcSpace.xs),
        textStyle: const TextStyle(
          fontSize: BcType.body,
          fontWeight: FontWeight.w600,
        ),
      ),
      child: Text(label),
    );
  }
}
