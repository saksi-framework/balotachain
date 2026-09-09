import 'package:flutter/material.dart';
import '../tokens.dart';

/// Scrolling screen body. Mirrors the mockup `Body`: 24px horizontal padding,
/// no vertical padding of its own.
class BcBody extends StatelessWidget {
  const BcBody({super.key, required this.children, this.padTop = 0});

  final List<Widget> children;
  final double padTop;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(BcSpace.md, padTop, BcSpace.md, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: children,
      ),
    );
  }
}

/// Pinned bottom action area. Mirrors the mockup `Footer`: 14px above, 24px
/// sides, 30px below to clear the home indicator.
class BcFooter extends StatelessWidget {
  const BcFooter({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: BcColors.bg,
      padding: const EdgeInsets.fromLTRB(BcSpace.md, 14, BcSpace.md, 30),
      child: SafeArea(top: false, child: child),
    );
  }
}
