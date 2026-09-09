import 'package:flutter/material.dart';
import '../tokens.dart';
import 'icons.dart';

/// Screen title bar. Mirrors the mockup `TopBar`: sits on the page background
/// (no surface fill, no divider), 44px back target on the left or a 16px
/// spacer, 20/700 title, optional trailing widget.
///
/// Used in the `Scaffold.appBar` slot, so the status-bar inset is added by the
/// Scaffold on top of [preferredSize] — that is the mockup's 58px top padding.
class BcTopBar extends StatelessWidget implements PreferredSizeWidget {
  const BcTopBar({super.key, required this.title, this.onBack, this.trailing});

  final String title;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  // 44px back target + 12px below = 56; the extra 2px keeps the Row off its
  // exact constraint so a rounded status-bar inset can't overflow it.
  Size get preferredSize => const Size.fromHeight(58);

  @override
  Widget build(BuildContext context) {
    return Container(
      color: BcColors.bg,
      padding: const EdgeInsets.only(
        left: BcSpace.xs,
        right: BcSpace.sm,
        bottom: 12,
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            if (onBack != null)
              SizedBox(
                width: 44,
                height: 44,
                child: IconButton(
                  onPressed: onBack,
                  padding: EdgeInsets.zero,
                  icon: const Icon(bcBack, size: 24),
                  color: BcColors.text1,
                  tooltip: 'Back',
                ),
              )
            else
              const SizedBox(width: BcSpace.sm, height: 44),
            const SizedBox(width: 4),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: BcType.h3,
                  fontWeight: FontWeight.w700,
                  color: BcColors.text1,
                  letterSpacing: 0.1,
                  height: 1.2,
                ),
              ),
            ),
            if (trailing != null) trailing!,
          ],
        ),
      ),
    );
  }
}
