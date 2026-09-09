import 'package:flutter/material.dart';
import '../tokens.dart';

/// `ba-pop` — scale 0.8 -> 1 with a slight overshoot, ~360ms. Used on the
/// splash badge and the vote-submitted success ring.
class BcPop extends StatelessWidget {
  const BcPop({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.8, end: 1.0),
      duration: const Duration(milliseconds: 360),
      curve: Curves.easeOutBack,
      builder: (context, value, child) =>
          Transform.scale(scale: value, child: child),
      child: child,
    );
  }
}

/// `ba-rise` — translateY 8 -> 0 with a fade, ~300ms. Used when the ballot step
/// changes and when the verification result appears. Give it a [ValueKey] that
/// changes to replay the animation.
class BcRise extends StatelessWidget {
  const BcRise({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween<double>(begin: 0.0, end: 1.0),
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeOut,
      builder: (context, value, child) => Opacity(
        opacity: value,
        child: Transform.translate(
          offset: Offset(0, 8 * (1 - value)),
          child: child,
        ),
      ),
      child: child,
    );
  }
}

/// `ba-dot` — three loading dots pulsing in opacity, staggered by 160ms.
class BcLoadingDots extends StatefulWidget {
  const BcLoadingDots({super.key, this.color = BcColors.surface});

  final Color color;

  @override
  State<BcLoadingDots> createState() => _BcLoadingDotsState();
}

class _BcLoadingDotsState extends State<BcLoadingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return Row(
          mainAxisSize: MainAxisSize.min,
          children: List<Widget>.generate(3, (i) {
            // Stagger each dot by 160ms across the 1200ms loop. phase stays
            // below 1, so the triangle wave below never leaves 0.3 .. 1.0.
            final phase = (_controller.value - i * (160 / 1200)) % 1.0;
            final opacity = 0.3 + 0.7 * (1 - (phase * 2 - 1).abs());
            return Padding(
              padding: EdgeInsets.only(left: i == 0 ? 0 : 6),
              child: Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: widget.color.withValues(alpha: opacity),
                ),
              ),
            );
          }),
        );
      },
    );
  }
}
