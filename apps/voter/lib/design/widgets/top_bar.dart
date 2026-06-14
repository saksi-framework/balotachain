import 'package:flutter/material.dart';
import '../tokens.dart';

class BcTopBar extends StatelessWidget implements PreferredSizeWidget {
  const BcTopBar({
    super.key,
    required this.title,
    this.onBack,
    this.trailing,
  });

  final String title;
  final VoidCallback? onBack;
  final Widget? trailing;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 56,
      decoration: const BoxDecoration(
        color: BcColors.surface,
        border: Border(
          bottom: BorderSide(color: BcColors.border, width: 1),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            SizedBox(
              width: 56,
              child: onBack != null
                  ? IconButton(
                      onPressed: onBack,
                      icon: const Icon(Icons.arrow_back),
                      color: BcColors.text1,
                    )
                  : null,
            ),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  fontSize: BcType.body,
                  fontWeight: FontWeight.w600,
                  color: BcColors.text1,
                  height: BcType.lineHeight,
                ),
              ),
            ),
            SizedBox(
              width: 56,
              child: trailing != null
                  ? Align(alignment: Alignment.centerRight, child: trailing)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
