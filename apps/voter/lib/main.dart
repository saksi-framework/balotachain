import 'package:flutter/material.dart';
import 'package:voter/design/design.dart';
import 'package:voter/screens/splash_screen.dart';

void main() => runApp(const BalotaChainApp());

class BalotaChainApp extends StatelessWidget {
  const BalotaChainApp({super.key});
  @override
  Widget build(BuildContext context) => MaterialApp(
        title: 'BalotaChain',
        debugShowCheckedModeBanner: false,
        theme: bcTheme(),
        home: const SplashScreen(),
      );
}
