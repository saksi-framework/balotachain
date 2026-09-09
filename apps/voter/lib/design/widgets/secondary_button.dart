import 'package:flutter/material.dart';
import '../tokens.dart';

/// Full-width outlined CTA. Mirrors the mockup `SecondaryButton`: transparent
/// fill, 1.5px teal border, 12px corners (not a pill) and a teal 18/600 label.
class BcSecondaryButton extends StatefulWidget {
  const BcSecondaryButton({
    super.key,
    required this.label,
    required this.onPressed,
  });

  final String label;
  final VoidCallback? onPressed;

  @override
  State<BcSecondaryButton> createState() => _BcSecondaryButtonState();
}

class _BcSecondaryButtonState extends State<BcSecondaryButton> {
  bool _down = false;

  void _setDown(bool value) {
    if (_down != value) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onPressed,
        onTapDown: enabled ? (_) => _setDown(true) : null,
        onTapUp: enabled ? (_) => _setDown(false) : null,
        onTapCancel: enabled ? () => _setDown(false) : null,
        child: AnimatedScale(
          scale: _down ? 0.978 : 1.0,
          duration: const Duration(milliseconds: 120),
          child: Opacity(
            opacity: enabled ? 1.0 : 0.45,
            child: Container(
              width: double.infinity,
              constraints: const BoxConstraints(minHeight: bcMinButtonHeight),
              padding: const EdgeInsets.symmetric(
                horizontal: BcSpace.md,
                vertical: 14,
              ),
              decoration: BoxDecoration(
                color: Colors.transparent,
                borderRadius: BorderRadius.circular(BcRadii.button),
                border: Border.all(color: BcColors.teal, width: 1.5),
              ),
              child: Text(
                widget.label,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: BcType.button,
                  fontWeight: FontWeight.w600,
                  color: BcColors.teal,
                  letterSpacing: 0.1,
                  height: 1.2,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
