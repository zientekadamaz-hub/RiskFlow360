# Risk Matrix UI standard audit - 2026-04-26

## Executive summary

Widok `Risk Matrix` ma teraz zaakceptowany wyglad i zostal uporzadkowany pod katem standardow UI. Najwazniejsza poprawka architektoniczna: elementy wizualne zwiazane z progami RPN, kaflami ryzyka, komorkami matrycy i popupem wyboru koloru zostaly przeniesione do wspolnej warstwy `src/features/settings/invitation-shell.tsx`, a nie sa juz lokalnymi decyzjami zakodowanymi tylko na stronie.

## Zmiany wdrozone

- `src/features/settings/invitation-shell.tsx`: dodano standardy Risk Matrix UI: kolory ryzyka, wypelnienie komorek matrycy, kafle progow RPN, label, rzad progu, comparator `RPN <=/>`, pill wartosci, zewnetrzny stepper, swatch popupu i segment button.
- `app/settings/risk-matrix/page.tsx`: strona korzysta teraz z centralnych standardow UI zamiast lokalnych styli dla zaakceptowanych elementow wizualnych.
- `app/settings/ui-preview/page.tsx`: dodano jawna sekcje `Risk Matrix threshold standard`, ktora pokazuje zaakceptowany wzorzec kafli, progow, steppera, komorek matrycy i popupu swatchy.

## Audyt senior developer

### Architektura UI

Status: poprawione czesciowo, kierunek dobry.

Co bylo nie tak: zaakceptowany styl Risk Matrix byl zapisany lokalnie w `page.tsx`, wiec kolejne strony nie mialy jednego zrodla prawdy.

Dlaczego to problem: przy dalszej migracji bardzo latwo byloby powielic podobne, ale nie identyczne style.

Jak powinno byc: kazdy zaakceptowany wzorzec UI trafia do wspolnych tokenow/standardow i jest widoczny na `ui-preview`.

Efekt: nowy standard jest centralny i pokazany na `ui-preview`.

Priorytet: HIGH.

### Spójnosc stylu

Status: poprawione.

Co bylo nie tak: kafle progow RPN, pill wartosci, stepper i swatche popupu byly poza standardem.

Efekt: te elementy maja teraz wspolne definicje i moga byc ponownie uzyte bez zgadywania rozmiarow, spacingu i kolorow.

Priorytet: HIGH.

### Kod strony Risk Matrix

Status: poprawione czesciowo.

Co nadal zostaje lokalne: logika Supabase, cache sesji, autosave, tryb `manual/rpn`, pozycjonowanie popupu, layout samej tabeli i obliczenia kolorow RPN.

Dlaczego to akceptowalne teraz: to sa elementy domenowe albo zachowanie specyficzne dla Risk Matrix, a nie globalny styl.

Co jeszcze warto poprawic pozniej: wydzielic logike danych do hooka/service, usunac `any` z obslugi bledow i payloadow Supabase, ujednolicic helpery sesji/cache z reszta aplikacji.

Priorytet: MEDIUM.

## Stan standardu UI

Elementy Risk Matrix obecne w standardzie:

- Risk summary tile colors: red/orange/yellow/green.
- Risk Matrix threshold tile.
- Centered RPN threshold row.
- RPN value pill.
- External up/down stepper.
- Matrix cell fill with grey base and 50% color overlay.
- Popup color swatch button.
- Segment button style for `MANUAL / RPN`.

Elementy widoczne w `ui-preview`:

- Kafle progow RPN.
- Mini podglad matrycy.
- Popup/swatch standard.

## Wyniki kontroli

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.

## Rekomendowane kolejne kroki

1. Przed migracja kolejnych stron stosowac zasade: jezeli element wizualny pojawia sie wiecej niz raz albo ma byc standardem, najpierw trafia do `ui-preview` i wspolnej warstwy UI.
2. Dla `Risk Matrix` w kolejnym kroku wydzielic logike Supabase/autosave do `src/features/settings/risk-matrix`.
3. Po ustabilizowaniu `Risk Matrix` przenosic ten sam model standardow na nastepne strony ustawien i moduly PFMEA/PFD/PCP.
