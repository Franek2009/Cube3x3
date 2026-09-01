# Model logiczny kostki 3x3

## Cel i zakres

Ten dokument jest kontraktem dla przyszłej implementacji stanu kostki i ruchów. Opisuje model na poziomie ruchomych elementów (`cubies`), bez centrów, naklejek renderera, solvera ani szczegółów interfejsu graficznego.

Centra nie są przechowywane w `CubeState`: ich wzajemne położenie jest stałe i wyznacza nazwy ścian. Przyjmujemy ściany `U` (up), `D` (down), `L` (left), `R` (right), `F` (front) i `B` (back). Stan opisuje 8 narożników i 12 krawędzi.

## Reprezentacja `CubeState`

`CubeState` składa się logicznie z czterech tablic:

```ts
cornerPermutation: number[]; // długość 8
cornerOrientation: number[]; // długość 8
edgePermutation: number[];   // długość 12
edgeOrientation: number[];   // długość 12
```

Indeks tablicy oznacza **pozycję (slot)** w kostce. Wartość tablicy permutacji oznacza **identyfikator cubie**, który aktualnie zajmuje ten slot. Wartość tablicy orientacji opisuje orientację cubie znajdującego się w tym samym slocie.

Przykładowo `cornerPermutation[URF] === UFL` oznacza, że narożnik `UFL` znajduje się obecnie w slocie `URF`. `cornerOrientation[URF]` jest wtedy orientacją narożnika `UFL` w tym slocie.

Implementacja może użyć zwykłych tablic, tablic typowanych albo struktur tylko do odczytu, lecz powyższa semantyka i kolejność indeksów są częścią kontraktu.

## Numeracja pozycji i cubies

Nazwa elementu jest złożeniem ścian, do których należą jego naklejki w stanie rozwiązanym. Ta sama kolejność służy do numerowania pozycji i identyfikatorów cubies.

### Narożniki

| Indeks | Nazwa | Uporządkowane sloty naklejek |
| ---: | :---: | :--- |
| 0 | `URF` | `(U, R, F)` |
| 1 | `UFL` | `(U, F, L)` |
| 2 | `ULB` | `(U, L, B)` |
| 3 | `UBR` | `(U, B, R)` |
| 4 | `DFR` | `(D, F, R)` |
| 5 | `DLF` | `(D, L, F)` |
| 6 | `DBL` | `(D, B, L)` |
| 7 | `DRB` | `(D, R, B)` |

### Krawędzie

| Indeks | Nazwa | Uporządkowane sloty naklejek |
| ---: | :---: | :--- |
| 0 | `UR` | `(U, R)` |
| 1 | `UF` | `(U, F)` |
| 2 | `UL` | `(U, L)` |
| 3 | `UB` | `(U, B)` |
| 4 | `DR` | `(D, R)` |
| 5 | `DF` | `(D, F)` |
| 6 | `DL` | `(D, L)` |
| 7 | `DB` | `(D, B)` |
| 8 | `FR` | `(F, R)` |
| 9 | `FL` | `(F, L)` |
| 10 | `BL` | `(B, L)` |
| 11 | `BR` | `(B, R)` |

Kolejność liter w tabelach jest istotna: określa uporządkowanie slotów naklejek używane poniżej do definiowania orientacji. Nie należy jej alfabetyzować ani wyprowadzać dynamicznie z nazw.

## Stan rozwiązany

W stanie rozwiązanym każdy cubie znajduje się w slocie o tym samym indeksie i ma orientację bazową `0`:

```ts
cornerPermutation = [0, 1, 2, 3, 4, 5, 6, 7];
cornerOrientation = [0, 0, 0, 0, 0, 0, 0, 0];

edgePermutation = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
edgeOrientation = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
```

Kolory nie są częścią podstawowego stanu. Tożsamość naklejki wynika z nazwy cubie: przykładowo narożnik `URF` ma naklejki `U`, `R`, `F`, a krawędź `BL` — naklejki `B`, `L`.

## Orientacja

Orientację definiujemy przez pozycję naklejek w uporządkowanych slotach z tabel, a nie przez kierunek obserwacji cubie. Eliminuje to niejednoznaczność określeń „skręcony zgodnie z zegarem”, szczególnie po przeniesieniu elementu między warstwami `U` i `D`.

### Orientacja narożnika

Orientacja narożnika jest liczbą z `Z₃`, czyli jedną z wartości `0`, `1`, `2`. Każdy narożnik ma naklejki zapisane w kolejności wynikającej z jego nazwy w tabeli narożników; każda pozycja narożna ma analogicznie uporządkowane trzy sloty.

Jeżeli narożnik o uporządkowanych naklejkach `(c0, c1, c2)` znajduje się w pozycji o uporządkowanych slotach `(s0, s1, s2)`, to orientacja `o` oznacza:

```text
c0 znajduje się w s[o]
c1 znajduje się w s[(o + 1) mod 3]
c2 znajduje się w s[(o + 2) mod 3]
```

Zatem:

- `0`: `(c0, c1, c2)` leżą odpowiednio w `(s0, s1, s2)` — orientacja bazowa;
- `1`: `(c0, c1, c2)` leżą odpowiednio w `(s1, s2, s0)`;
- `2`: `(c0, c1, c2)` leżą odpowiednio w `(s2, s0, s1)`.

Pierwszą naklejką każdego narożnika jest zawsze jego naklejka `U` albo `D`. Sama informacja, na której osi znajduje się ta naklejka, nie wystarcza jednak do odróżnienia `1` od `2`; rozstrzyga to dokładna kolejność slotów w tabeli.

Przykład: dla cubie `URF` w slocie `DFR`, którego sloty mają kolejność `(D, F, R)`, orientacja `1` oznacza `U → F`, `R → R`, `F → D`, a orientacja `2` oznacza `U → R`, `R → D`, `F → F`.

Wszystkie obliczenia i aktualizacje orientacji narożników wykonuje się modulo `3`.

### Orientacja krawędzi

Orientacja krawędzi jest liczbą z `Z₂`, czyli `0` albo `1`. Jeżeli krawędź o uporządkowanych naklejkach `(c0, c1)` znajduje się w pozycji o uporządkowanych slotach `(s0, s1)`, to:

- `0`: `c0` znajduje się w `s0`, a `c1` w `s1` — orientacja bazowa;
- `1`: `c0` znajduje się w `s1`, a `c1` w `s0` — krawędź odwrócona.

Przykład: cubie `FR` ma uporządkowane naklejki `(F, R)`. W slocie `UF`, uporządkowanym jako `(U, F)`, orientacja `0` oznacza `F → U`, `R → F`, a orientacja `1` oznacza `F → F`, `R → U`.

Wszystkie obliczenia i aktualizacje orientacji krawędzi wykonuje się modulo `2`.

Ta konwencja została wybrana, ponieważ jest kompletna, łatwa do walidacji i pozwala mechanicznie wyznaczać orientację z rozmieszczenia naklejek. Jest też zgodna z powszechnym uporządkowaniem cubies używanym w modelach współrzędnych kostki.

## Legalność stanu

Stan jest legalnym stanem kostki 3x3 osiągalnym ruchami ścian wtedy i tylko wtedy, gdy spełnia łącznie następujące warunki:

1. Tablice mają wymagane długości: `8`, `8`, `12`, `12`.
2. `cornerPermutation` jest permutacją zbioru `{0, ..., 7}`: każdy narożnik występuje dokładnie raz.
3. `edgePermutation` jest permutacją zbioru `{0, ..., 11}`: każda krawędź występuje dokładnie raz.
4. Każda orientacja narożnika jest liczbą całkowitą ze zbioru `{0, 1, 2}`.
5. Każda orientacja krawędzi jest liczbą całkowitą ze zbioru `{0, 1}`.
6. Suma orientacji narożników spełnia `sum(cornerOrientation) mod 3 === 0`.
7. Suma orientacji krawędzi spełnia `sum(edgeOrientation) mod 2 === 0`.
8. Permutacje narożników i krawędzi mają tę samą parzystość: obie są parzyste albo obie nieparzyste.

Parzystość można obliczyć przez liczbę inwersji modulo `2` albo rozkład permutacji na cykle. Nie wolno uznawać za legalny stanu, który spełnia tylko ograniczenia orientacji, lecz narusza zgodność parzystości.

## Notacja ruchów

Pierwsza wersja obsługuje wyłącznie obroty zewnętrznych ścian:

```text
U D L R F B
```

Każda litera bez sufiksu oznacza ćwierćobrót o `90°` zgodnie z ruchem wskazówek zegara. Kierunek zawsze określamy, **patrząc bezpośrednio na obracaną ścianę z zewnątrz kostki**. W szczególności tę samą regułę stosujemy do ścian `D`, `L` i `B`; nie interpretujemy ich kierunku z perspektywy obserwatora patrzącego na `F`.

Dozwolone sufiksy:

- apostrof (`'`) — ćwierćobrót o `90°` przeciwnie do ruchu wskazówek zegara, np. `R'`;
- `2` — półobrót o `180°`, np. `R2`; jego kierunek nie wpływa na wynik.

Pełny zbiór tokenów pierwszej wersji to:

```text
U U' U2  D D' D2  L L' L2
R R' R2  F F' F2  B B' B2
```

Sekwencja ruchów jest zapisywana w kolejności wykonania od lewej do prawej, z tokenami oddzielonymi białymi znakami, np. `R U R' U'`. Notacje warstw środkowych, obrotów całej kostki, szerokich ruchów oraz sufiksów innych niż `'` i `2` pozostają poza zakresem pierwszej wersji.

Odwrotność pojedynczego ruchu zamienia brak sufiksu z `'` (i odwrotnie), a ruch `2` pozostawia bez zmian. Odwrotność sekwencji powstaje przez odwrócenie kolejności tokenów i zastąpienie każdego tokenu jego odwrotnością.

## Planowane podstawowe API `CubeState`

Dokładne sygnatury TypeScript zostaną ustalone podczas implementacji, ale zachowanie metod ma spełniać poniższy kontrakt:

- `solvedState()` — tworzy nowy, legalny stan rozwiązany zgodny z tablicami podanymi wyżej;
- `clone()` — tworzy niezależną, głęboką kopię stanu, choć przy immutable API będzie używane głównie tam, gdzie jawna kopia jest potrzebna;
- `equals(other)` — porównuje wartości wszystkich czterech tablic, a nie tożsamość obiektów;
- `isSolved()` — zwraca `true` dokładnie wtedy, gdy wszystkie permutacje są identycznościowe i wszystkie orientacje wynoszą `0`;
- `applyMove(move)` — nie modyfikuje bieżącego `CubeState`; zwraca nowy `CubeState` zawierający wynik zastosowania jednego poprawnego tokenu ruchu zgodnie z niniejszą konwencją;
- `applyMoves(moves)` — nie modyfikuje bieżącego `CubeState`; zwraca nowy `CubeState` zawierający wynik zastosowania całej sekwencji ruchów od lewej do prawej, równoważnie kolejnym wywołaniom `applyMove`.

Publiczne API `CubeState` jest immutable. Oryginalny `CubeState` musi pozostać niezmieniony po każdym wywołaniu operacji, a implementacja nie może ujawniać mutowalnych wewnętrznych tablic w sposób pozwalający zmienić stan z zewnątrz.

Immutable publiczny `CubeState` upraszcza kontrolę stanu aplikacji, historię, playback i synchronizację z rendererem. Solver może później używać własnych zoptymalizowanych reprezentacji lub coordinates w krytycznych wydajnościowo fragmentach.

Późniejsze rozszerzenia API mogą obejmować:

- `serialize()` i `deserialize()` — stabilny format zapisu wraz z jednoznaczną kolejnością tablic i walidacją danych wejściowych;
- `validate()` — sprawdzenie wszystkich warunków legalności opisanych powyżej i zwrócenie użytecznej informacji o naruszeniu kontraktu.

Format serializacji oraz sposób zgłaszania błędów nie są jeszcze częścią kontraktu.

## Własności wymagane w testach

Po zaimplementowaniu modelu i ruchów testy własności powinny co najmniej potwierdzać:

1. Dla każdej ściany `X ∈ {U, D, L, R, F, B}` sekwencja `X X X X` daje identyczność.
2. Dla każdego obsługiwanego ruchu `move` wykonanie `move`, a następnie `inverse(move)`, daje identyczność. Dotyczy to także wariantów prime i double.
3. Dla każdej poprawnej sekwencji `sequence` wykonanie `sequence`, a następnie `inverse(sequence)`, daje identyczność.
4. `solvedState().isSolved()` zwraca `true`.
5. Każdy stan rozwiązany porównuje się jako równy innemu stanowi rozwiązanemu, a jego niezależny klon także jest rozwiązany.

W powyższych testach „identyczność” oznacza dokładną równość wszystkich czterech tablic ze stanem rozwiązanym, nie tylko wizualnie jednolite ściany.
