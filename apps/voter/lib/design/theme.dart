import 'package:flutter/material.dart';
import 'tokens.dart';

ThemeData bcTheme() {
  const baseText = TextStyle(
    fontSize: BcType.body,
    height: BcType.lineHeight,
    color: BcColors.text1,
  );

  final colorScheme = ColorScheme.fromSeed(
    seedColor: BcColors.teal,
    primary: BcColors.teal,
    onPrimary: BcColors.surface,
    surface: BcColors.surface,
    onSurface: BcColors.text1,
    error: BcColors.error,
    brightness: Brightness.light,
  );

  return ThemeData(
    useMaterial3: true,
    colorScheme: colorScheme,
    scaffoldBackgroundColor: BcColors.bg,
    canvasColor: BcColors.bg,
    cardColor: BcColors.surface,
    dividerColor: BcColors.border,
    splashFactory: InkRipple.splashFactory,
    textTheme: TextTheme(
      displayLarge: baseText.copyWith(
        fontSize: BcType.h1,
        fontWeight: FontWeight.w700,
      ),
      headlineLarge: baseText.copyWith(
        fontSize: BcType.h1,
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: baseText.copyWith(
        fontSize: BcType.h2,
        fontWeight: FontWeight.w700,
      ),
      titleLarge: baseText.copyWith(
        fontSize: BcType.h2,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: baseText,
      bodyMedium: baseText,
      labelLarge: baseText.copyWith(
        fontSize: BcType.button,
        fontWeight: FontWeight.w600,
      ),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: BcColors.surface,
      foregroundColor: BcColors.text1,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: false,
    ),
    iconTheme: const IconThemeData(color: BcColors.text1),
  );
}
