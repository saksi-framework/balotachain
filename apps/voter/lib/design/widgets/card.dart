import 'package:flutter/material.dart';
import '../tokens.dart';

/// Surface panel: white fill, 1px border, 16px corners, [BcShadows.card].
/// Pass [padding] to match the mockup's per-context padding (22 on the election
/// card, 20 on the tracking-code card, 8/16 on review blocks).
class BcCard extends StatelessWidget {
  const BcCard({super.key, required this.child, this.padding, this.flat = false});

  final Widget child;
  final EdgeInsets? padding;

  /// Uses the lighter [BcShadows.subtle] instead of the lifted card shadow.
  final bool flat;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: padding ?? const EdgeInsets.all(BcSpace.md),
      decoration: BoxDecoration(
        color: BcColors.surface,
        borderRadius: BorderRadius.circular(BcRadii.card),
        border: Border.all(color: BcColors.border, width: 1),
        boxShadow: flat ? BcShadows.subtle : BcShadows.card,
      ),
      child: child,
    );
  }
}
