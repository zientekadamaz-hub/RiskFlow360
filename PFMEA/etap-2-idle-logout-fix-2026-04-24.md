# Idle Logout Fix - 2026-04-24

## Problem
Auto-logout po 10 minutach bezczynnosci przestal dzialac.

## Root cause
`IdleLogout` resetowal timer nie tylko od aktywnosci uzytkownika, ale tez od zdarzen sesji Supabase. W praktyce `TOKEN_REFRESHED` odswiezal `last activity`, wiec deadline bezczynnosci przesuwal sie bez realnej aktywnosci.

## Fix
- dodano wspolny modul [src/lib/auth/idle-session.ts](</c:/Users/zieada/pfmea-app/src/lib/auth/idle-session.ts>)
- `IdleLogout` korzysta teraz ze wspolnych kluczy i helperow
- reset aktywnosci po stronie `supabase.auth.onAuthStateChange(...)` dzieje sie juz tylko dla:
  - `INITIAL_SESSION`
  - `SIGNED_IN`
- `TOKEN_REFRESHED` nie resetuje juz bezczynnosci
- licznik w [AppHeader.tsx](</c:/Users/zieada/pfmea-app/src/components/Layout/AppHeader.tsx>) czyta ten sam `LAST_ACTIVITY_KEY`, wiec UI i realny logout korzystaja z jednego zrodla prawdy

## Walidacja
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Wszystkie przeszly.

## Remaining note
Nie robilem 10-minutowego manualnego odczekania end-to-end w tej turze. Jesli chcesz, nastepny krok moge zrobic jako szybki test techniczny z tymczasowo skroconym progiem idle, a potem przywrocic wartosc 10 minut.
