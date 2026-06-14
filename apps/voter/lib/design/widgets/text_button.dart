import 'package:flutter/material.dart';
import '../tokens.dart';

class BcTextButton extends StatelessWidget {
  const BcTextButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return TextButton(
      onPressed: onPressed,
      style: TextButton.styleFrom(
        foregroundColor: BcColors.teal,
        backgroundColor: Colors.transparent,
        padding: const EdgeInsets.symmetric(
          horizontal: BcSpace.sm,
          vertical: BcSpace.xs,
        ),
        textStyle: const TextStyle(
          fontSize: BcType.button,
          fontWeight: FontWeight.w600,
        ),
      ),
      child: Text(label),
    );
  }
}
