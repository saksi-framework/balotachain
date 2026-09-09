import 'package:flutter/material.dart';
import '../tokens.dart';

/// Full-width pill CTA. Mirrors the mockup `PrimaryButton`: 56px min height,
/// teal fill, white 18/600 label and a lifted shadow. Disabled falls back to
/// the neutral fill with muted text and no shadow.
class BcPrimaryButton extends StatefulWidget {
  const BcPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
  });

  final String label;
  final VoidCallback? onPressed;

  /// Optional leading glyph (mockup shows one on the trustee-style CTA).
  final IconData? icon;

  @override
  State<BcPrimaryButton> createState() => _BcPrimaryButtonState();
}

class _BcPrimaryButtonState extends State<BcPrimaryButton> {
  bool _down = false;

  void _setDown(bool value) {
    if (_down != value) setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    final enabled = widget.onPressed != null;
    final fg = enabled ? BcColors.surface : BcColors.text2;

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
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            width: double.infinity,
            constraints: const BoxConstraints(minHeight: bcMinButtonHeight),
            padding: const EdgeInsets.symmetric(
              horizontal: BcSpace.md,
              vertical: 14,
            ),
            decoration: BoxDecoration(
              color: enabled ? BcColors.teal : BcColors.neutralFill,
              borderRadius: BorderRadius.circular(BcRadii.pill),
              boxShadow: enabled ? BcShadows.button : const <BoxShadow>[],
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.icon != null) ...[
                  Icon(widget.icon, size: 20, color: fg),
                  const SizedBox(width: 10),
                ],
                Flexible(
                  child: Text(
                    widget.label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: BcType.button,
                      fontWeight: FontWeight.w600,
                      color: fg,
                      letterSpacing: 0.1,
                      height: 1.2,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
