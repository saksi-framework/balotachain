import 'package:flutter/material.dart';
import '../tokens.dart';

class BcSecondaryButton extends StatelessWidget {
  const BcSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.fullWidth = false,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool fullWidth;

  @override
  Widget build(BuildContext context) {
    final enabled = onPressed != null;
    final button = Opacity(
      opacity: enabled ? 1.0 : 0.5,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: bcMinButtonHeight),
        child: OutlinedButton(
          onPressed: onPressed,
          style: OutlinedButton.styleFrom(
            foregroundColor: BcColors.teal,
            backgroundColor: Colors.transparent,
            disabledForegroundColor: BcColors.teal,
            minimumSize: const Size(0, bcMinButtonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: BcSpace.md,
              vertical: BcSpace.sm,
            ),
            side: const BorderSide(color: BcColors.teal, width: 1),
            shape: const StadiumBorder(),
            textStyle: const TextStyle(
              fontSize: BcType.button,
              fontWeight: FontWeight.w600,
            ),
          ),
          child: Text(label),
        ),
      ),
    );

    if (fullWidth) {
      return SizedBox(width: double.infinity, child: button);
    }
    return button;
  }
}
