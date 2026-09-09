import 'dart:async';

import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/onboarding_screen.dart';

/// Splash — dark teal field, popped-in shield badge, wordmark, and three
/// pulsing dots. Auto-advances after 2.4s, or on tap.
class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer(const Duration(milliseconds: 2400), _advance);
  }

  void _advance() {
    if (!mounted) return;
    _timer?.cancel();
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const OnboardingScreen()),
    );
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: BcColors.tealDark,
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _advance,
        child: Stack(
          children: [
            Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const BcPop(
                    child: _SplashBadge(),
                  ),
                  const SizedBox(height: 26),
                  const Text(
                    'BalotaChain',
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w700,
                      color: BcColors.surface,
                      letterSpacing: 0.2,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'SECURE · PRIVATE · VERIFIABLE',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.w500,
                      letterSpacing: 1.4,
                      height: 1.2,
                      color: BcColors.surface.withValues(alpha: 0.7),
                    ),
                  ),
                ],
              ),
            ),
            const Positioned(
              left: 0,
              right: 0,
              bottom: 54,
              child: Center(child: BcLoadingDots()),
            ),
          ],
        ),
      ),
    );
  }
}

class _SplashBadge extends StatelessWidget {
  const _SplashBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 76,
      height: 76,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: BcColors.surface.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: BcColors.surface.withValues(alpha: 0.25),
          width: 1.5,
        ),
      ),
      child: const Icon(bcShieldCheck, size: 40, color: BcColors.surface),
    );
  }
}
