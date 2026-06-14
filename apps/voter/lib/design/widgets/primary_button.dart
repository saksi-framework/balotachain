import 'package:flutter/material.dart';
import '../tokens.dart';

class BcPrimaryButton extends StatelessWidget {
  const BcPrimaryButton({
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
        child: ElevatedButton(
          onPressed: onPressed,
          style: ElevatedButton.styleFrom(
            backgroundColor: BcColors.teal,
            foregroundColor: BcColors.surface,
            disabledBackgroundColor: BcColors.teal,
            disabledForegroundColor: BcColors.surface,
            elevation: 0,
            shadowColor: Colors.transparent,
            minimumSize: const Size(0, bcMinButtonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: BcSpace.md,
              vertical: BcSpace.sm,
            ),
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
