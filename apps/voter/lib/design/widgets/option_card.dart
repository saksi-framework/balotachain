import 'package:flutter/material.dart';
import '../tokens.dart';

class BcOptionCard extends StatelessWidget {
  const BcOptionCard({
    super.key,
    required this.label,
    this.description,
    required this.selected,
    required this.onTap,
    this.multi = false,
    this.disabled = false,
  });

  final String label;
  final String? description;
  final bool selected;
  final VoidCallback onTap;
  final bool multi;
  final bool disabled;

  @override
  Widget build(BuildContext context) {
    final borderColor = selected ? BcColors.teal : BcColors.border;
    final borderWidth = selected ? 2.0 : 1.0;
    final bg = selected ? BcColors.tealLight : BcColors.surface;

    final content = Container(
      width: double.infinity,
      padding: const EdgeInsets.all(BcSpace.sm),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(BcRadii.card),
        border: Border.all(color: borderColor, width: borderWidth),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    fontSize: BcType.body,
                    fontWeight: FontWeight.w600,
                    color: BcColors.text1,
                    height: BcType.lineHeight,
                  ),
                ),
                if (description != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    description!,
                    style: const TextStyle(
                      fontSize: BcType.body,
                      color: BcColors.text2,
                      height: BcType.lineHeight,
                    ),
                  ),
                ],
              ],
            ),
          ),
          if (selected) ...[
            const SizedBox(width: BcSpace.sm),
            const Icon(Icons.check, color: BcColors.teal, size: 24),
          ],
        ],
      ),
    );

    return Opacity(
      opacity: disabled ? 0.5 : 1.0,
      child: IgnorePointer(
        ignoring: disabled,
        child: Semantics(
          button: true,
          selected: selected,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(BcRadii.card),
            child: content,
          ),
        ),
      ),
    );
  }
}
