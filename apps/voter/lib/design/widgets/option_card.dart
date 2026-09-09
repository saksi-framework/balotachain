import 'package:flutter/material.dart';
import '../tokens.dart';

/// Initials shown in the avatar tile: first letter of the first and last word
/// ("Andrea Reyes" -> "AR"). Falls back to the first two letters for a
/// single-word name.
String bcInitials(String name) {
  final words = name.trim().split(RegExp(r'\s+')).where((w) => w.isNotEmpty);
  if (words.isEmpty) return '';
  if (words.length == 1) {
    final w = words.first;
    return (w.length == 1 ? w : w.substring(0, 2)).toUpperCase();
  }
  return '${words.first[0]}${words.last[0]}'.toUpperCase();
}

/// Selectable candidate row. Mirrors the mockup `OptionCard`: 46px initials
/// avatar, name + role, and a trailing indicator that is a rounded square when
/// `multi` (checkbox semantics) or a circle when single-choice.
class BcOptionCard extends StatelessWidget {
  const BcOptionCard({
    super.key,
    required this.label,
    this.description,
    this.initials,
    required this.selected,
    required this.onTap,
    this.multi = false,
    this.disabled = false,
  });

  final String label;
  final String? description;

  /// Overrides the initials derived from [label].
  final String? initials;
  final bool selected;
  final VoidCallback onTap;
  final bool multi;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final avatarInitials = initials ?? bcInitials(label);

    final card = AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: double.infinity,
      padding: const EdgeInsets.all(BcSpace.sm),
      decoration: BoxDecoration(
        color: selected ? BcColors.tealLight : BcColors.surface,
        borderRadius: BorderRadius.circular(BcRadii.card),
        border: Border.all(
          color: selected ? BcColors.teal : BcColors.border,
          width: selected ? 2 : 1.5,
        ),
        boxShadow: selected ? const <BoxShadow>[] : BcShadows.subtle,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 46,
            height: 46,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? BcColors.teal : BcColors.neutralFill,
              borderRadius: BorderRadius.circular(14),
            ),
            child: Text(
              avatarInitials,
              style: TextStyle(
                fontSize: 17,
                fontWeight: FontWeight.w600,
                color: selected ? BcColors.surface : BcColors.text2,
              ),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w600,
                    color: BcColors.text1,
                    height: 1.3,
                  ),
                ),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    description!,
                    style: const TextStyle(
                      fontSize: 14,
                      color: BcColors.text2,
                      height: 1.4,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: BcSpace.xs),
          Container(
            width: 26,
            height: 26,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: selected ? BcColors.teal : Colors.transparent,
              borderRadius: BorderRadius.circular(multi ? 8 : BcRadii.pill),
              border: selected
                  ? null
                  : Border.all(color: BcColors.border, width: 2),
            ),
            child: selected
                ? const Icon(Icons.check, size: 16, color: BcColors.surface)
                : null,
          ),
        ],
      ),
    );

    return Opacity(
      opacity: disabled ? 0.42 : 1.0,
      child: IgnorePointer(
        ignoring: disabled,
        child: Semantics(
          button: true,
          selected: selected,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: onTap,
            child: card,
          ),
        ),
      ),
    );
  }
}
