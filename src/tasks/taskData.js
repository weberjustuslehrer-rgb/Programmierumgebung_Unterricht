export const tasks = [
    {
        id: "turtle-01",
        title: "1. Erste Schritte",
        description: `
Lass die Turtle 100 Schritte vorwärts gehen.

Ziel:
- erste Anweisung kennenlernen
- Run ausprobieren
- Zeichenfläche beobachten
        `.trim(),
        concepts: ["Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Hilfreicher Befehl",
        helperSnippet: `vorwaerts(100)`,
        referenceTaskIds: [],
        hint: "Nutze den Befehl vorwaerts(100).",
        solution: `vorwaerts(100)`,
        requires: {
            exactTrace: [
                { type: "forward", value: 100 }
            ]
        }
    },

    {
        id: "turtle-02",
        title: "2. Zwei Befehle nacheinander",
        description: `
Zeichne 100 Schritte vorwärts, drehe dich dann um 90 Grad nach links
und gehe noch einmal 100 Schritte.

Ziel:
- Reihenfolge von Befehlen verstehen
- Sequenz erkennen
        `.trim(),
        concepts: ["Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Baustein aus Aufgabe 1",
        helperSnippet: `vorwaerts(100)`,
        referenceTaskIds: ["turtle-01"],
        hint: "Ein rechter Winkel sind 90 Grad. Nutze also dreheLinks(90).",
        solution: `vorwaerts(100)
dreheLinks(90)
vorwaerts(100)`,
        requires: {
            exactTrace: [
                { type: "forward", value: 100 },
                { type: "left", value: 90 },
                { type: "forward", value: 100 }
            ]
        }
    },

    {
        id: "turtle-03",
        title: "3. Quadrat ohne Schleife",
        description: `
Zeichne ein Quadrat mit Seitenlänge 100 – noch ohne Wiederholung.

Ziel:
- längere Sequenzen lesen und schreiben
- Wiederholungen im Code erkennen, auch wenn noch keine Schleife genutzt wird
        `.trim(),
        concepts: ["Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Erinnerung an Aufgabe 2",
        helperSnippet: `vorwaerts(100)
dreheLinks(90)`,
        referenceTaskIds: ["turtle-02"],
        hint: "Ein Quadrat hat 4 gleich lange Seiten und 4 rechte Winkel.",
        solution: `vorwaerts(100)
dreheLinks(90)
vorwaerts(100)
dreheLinks(90)
vorwaerts(100)
dreheLinks(90)
vorwaerts(100)
dreheLinks(90)`,
        requires: {
            exactTrace: [
                { type: "forward", value: 100 },
                { type: "left", value: 90 },
                { type: "forward", value: 100 },
                { type: "left", value: 90 },
                { type: "forward", value: 100 },
                { type: "left", value: 90 },
                { type: "forward", value: 100 },
                { type: "left", value: 90 }
            ]
        }
    },

    {
        id: "turtle-04",
        title: "4. Quadrat mit Wiederholung",
        description: `
Zeichne dasselbe Quadrat wie in Aufgabe 3, aber jetzt mit einer Wiederholung.

Schau dir danach auch das Struktogramm an.

Ziel:
- Wiederholung statt mehrfacher gleicher Anweisungen
- Zusammenhang zwischen Code und Struktogramm erkennen
        `.trim(),
        concepts: ["Wiederholung", "Struktogramm"],
        emptyStarterCode: "",
        helperLabel: "Vorherige Lösung als Idee",
        helperSnippet: `vorwaerts(100)
dreheLinks(90)`,
        referenceTaskIds: ["turtle-03"],
        hint: "Du brauchst viermal denselben Block. Verwende Wiederhole 4 Mal.",
        solution: `Wiederhole 4 Mal
    vorwaerts(100)
    dreheLinks(90)
Ende Wiederhole`,
        requires: {
            tracePattern: [
                { type: "forward", value: 100, count: 4 },
                { type: "left", value: 90, count: 4 }
            ],
            sourceIncludes: ["Wiederhole 4 Mal", "Ende Wiederhole"]
        }
    },

    {
        id: "turtle-05",
        title: "5. Rechteck mit Wiederholung",
        description: `
Zeichne ein Rechteck mit Seitenlängen 150 und 80.

Ziel:
- Wiederholung sinnvoll einsetzen
- zwischen gleichen und unterschiedlichen Schritten unterscheiden
        `.trim(),
        concepts: ["Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Nützlicher Baustein",
        helperSnippet: `vorwaerts(150)
dreheLinks(90)
vorwaerts(80)
dreheLinks(90)`,
        referenceTaskIds: ["turtle-04"],
        hint: "Ein Rechteck besteht aus zwei gleichen Doppelschritten.",
        solution: `Wiederhole 2 Mal
    vorwaerts(150)
    dreheLinks(90)
    vorwaerts(80)
    dreheLinks(90)
Ende Wiederhole`,
        requires: {
            sourceIncludes: ["Wiederhole 2 Mal", "Ende Wiederhole"],
            exactTrace: [
                { type: "forward", value: 150 },
                { type: "left", value: 90 },
                { type: "forward", value: 80 },
                { type: "left", value: 90 },
                { type: "forward", value: 150 },
                { type: "left", value: 90 },
                { type: "forward", value: 80 },
                { type: "left", value: 90 }
            ]
        }
    },

    {
        id: "turtle-06",
        title: "6. Dreieck mit Wiederholung",
        description: `
Zeichne ein gleichseitiges Dreieck mit Seitenlänge 100.

Ziel:
- Wiederholung anwenden
- geeigneten Drehwinkel finden
        `.trim(),
        concepts: ["Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Hinweis",
        helperSnippet: `Wiederhole 3 Mal
    vorwaerts(100)
    dreheLinks(120)
Ende Wiederhole`,
        referenceTaskIds: [],
        hint: "Die Turtle braucht beim gleichseitigen Dreieck 120 Grad Drehung.",
        solution: `Wiederhole 3 Mal
    vorwaerts(100)
    dreheLinks(120)
Ende Wiederhole`,
        requires: {
            sourceIncludes: ["Wiederhole 3 Mal"],
            tracePattern: [
                { type: "forward", value: 100, count: 3 },
                { type: "left", value: 120, count: 3 }
            ]
        }
    },

    {
        id: "turtle-07",
        title: "7. Gehe zu einer Startposition",
        description: `
Gehe zuerst ohne zu zeichnen zu der Position (-100, 100).
Zeichne dort dann eine Linie mit 120 Schritten.

Ziel:
- stiftHoch / stiftRunter
- geheZu
- Sequenz mit Zustandswechsel
        `.trim(),
        concepts: ["Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Nützliche Befehle",
        helperSnippet: `stiftHoch()
geheZu(-100, 100)
stiftRunter()`,
        referenceTaskIds: [],
        hint: "Ohne Stift bewegen, dann Stift wieder herunterlassen.",
        solution: `stiftHoch()
geheZu(-100, 100)
stiftRunter()
vorwaerts(120)`,
        requires: {
            exactTrace: [
                { type: "penUp" },
                { type: "moveTo", x: -100, y: 100 },
                { type: "penDown" },
                { type: "forward", value: 120 }
            ]
        }
    },

    {
        id: "turtle-08",
        title: "8. Unterprogramm für ein Quadrat",
        description: `
Lege ein Unterprogramm mit dem Namen Quadrat an.
Es soll ein Quadrat mit Seitenlänge 80 zeichnen.

Danach rufe es im Hauptprogramm einmal auf.

Ziel:
- Unterprogramme anlegen
- Aufruf aus dem Hauptprogramm
        `.trim(),
        concepts: ["Unterprogramme", "Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Idee für den Inhalt des Unterprogramms",
        helperSnippet: `Wiederhole 4 Mal
    vorwaerts(80)
    dreheLinks(90)
Ende Wiederhole`,
        referenceTaskIds: ["turtle-04"],
        hint: "Das Zeichnen kommt ins Unterprogramm, im Hauptprogramm steht nur der Aufruf.",
        solution: `Rufe Quadrat auf`,
        requires: {
            sourceIncludes: ["Rufe Quadrat auf"],
            customCheck: "subprogramSquare80"
        }
    },

    {
        id: "turtle-09",
        title: "9. Unterprogramm zweimal aufrufen",
        description: `
Nutze dein Unterprogramm Quadrat aus Aufgabe 8 zweimal:
- einmal an der Startposition
- einmal nach einem Sprung zu einer anderen Position

Ziel:
- Wiederverwendung von Unterprogrammen
- Struktur statt Kopieren
        `.trim(),
        concepts: ["Unterprogramme", "Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Möglicher Baustein",
        helperSnippet: `Rufe Quadrat auf

stiftHoch()
geheZu(150, 0)
stiftRunter()

Rufe Quadrat auf`,
        referenceTaskIds: ["turtle-08"],
        hint: "Statt den Quadrat-Code zu kopieren, sollst du das Unterprogramm erneut aufrufen.",
        solution: `Rufe Quadrat auf

stiftHoch()
geheZu(150, 0)
stiftRunter()

Rufe Quadrat auf`,
        requires: {
            sourceIncludes: ["Rufe Quadrat auf", "geheZu("],
            customCheck: "twoSquareCalls"
        }
    },

    {
        id: "turtle-10",
        title: "10. Alternative mit Eingabe",
        description: `
Nutze eine Eingabe vom Typ Ganzzahl mit dem Namen seiten.

Wenn seiten gleich 3 ist, zeichne ein Dreieck.
Sonst zeichne ein Quadrat.

Ziel:
- Alternative kennenlernen
- Struktogramm dazu anschauen
        `.trim(),
        concepts: ["Alternative", "Struktogramm"],
        emptyStarterCode: "",
        helperLabel: "Beispielstruktur",
        helperSnippet: `Eingabe Ganzzahl seiten

Wenn seiten == 3 Dann
    ...
Sonst
    ...
Ende Wenn`,
        referenceTaskIds: ["turtle-04", "turtle-06"],
        hint: "Im Wenn-Zweig kommt das Dreieck, im Sonst-Zweig das Quadrat.",
        solution: `Eingabe Ganzzahl seiten

Wenn seiten == 3 Dann
    Wiederhole 3 Mal
        vorwaerts(100)
        dreheLinks(120)
    Ende Wiederhole
Sonst
    Wiederhole 4 Mal
        vorwaerts(100)
        dreheLinks(90)
    Ende Wiederhole
Ende Wenn`,
        requires: {
            sourceIncludes: ["Wenn", "Sonst", "Ende Wenn", "Eingabe Ganzzahl seiten"],
            customCheck: "ifTriangleElseSquare"
        }
    },

    {
        id: "turtle-11",
        title: "11. Zickzack mit Wiederholung",
        description: `
Zeichne ein Zickzackmuster:
- 4 Mal vorwaerts(60)
- dann abwechselnd links 45 und rechts 90

Ziel:
- Wiederholung mit mehreren Anweisungen
        `.trim(),
        concepts: ["Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Startidee",
        helperSnippet: `Wiederhole 4 Mal
    vorwaerts(60)
    dreheLinks(45)
    vorwaerts(60)
    dreheRechts(90)
Ende Wiederhole`,
        referenceTaskIds: [],
        hint: "Die Wiederholung enthält mehrere Befehle, nicht nur einen.",
        solution: `Wiederhole 4 Mal
    vorwaerts(60)
    dreheLinks(45)
    vorwaerts(60)
    dreheRechts(90)
Ende Wiederhole`,
        requires: {
            sourceIncludes: ["Wiederhole 4 Mal"],
            tracePattern: [
                { type: "forward", value: 60, count: 8 },
                { type: "left", value: 45, count: 4 },
                { type: "right", value: 90, count: 4 }
            ]
        }
    },

    {
        id: "turtle-12",
        title: "12. Unterprogramm Dreieck",
        description: `
Erstelle ein Unterprogramm Dreieck und rufe es einmal auf.

Ziel:
- zweites Unterprogramm anlegen
- Form als Baustein denken
        `.trim(),
        concepts: ["Unterprogramme"],
        emptyStarterCode: "",
        helperLabel: "Möglicher Inhalt",
        helperSnippet: `Wiederhole 3 Mal
    vorwaerts(100)
    dreheLinks(120)
Ende Wiederhole`,
        referenceTaskIds: ["turtle-06"],
        hint: "Lege das Unterprogramm an und rufe es im Hauptprogramm auf.",
        solution: `Rufe Dreieck auf`,
        requires: {
            sourceIncludes: ["Rufe Dreieck auf"],
            customCheck: "subprogramTriangle"
        }
    },

    {
        id: "turtle-13",
        title: "13. Haus aus Unterprogrammen",
        description: `
Zeichne ein Haus, indem du:
- zuerst ein Quadrat-Unterprogramm nutzt
- dann an die Dachposition gehst
- dann ein Dreieck-Unterprogramm nutzt

Ziel:
- mehrere Unterprogramme kombinieren
        `.trim(),
        concepts: ["Unterprogramme", "Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Bausteine, die helfen können",
        helperSnippet: `Rufe Quadrat auf

stiftHoch()
geheZu(0, 80)
stiftRunter()

Rufe Dreieck auf`,
        referenceTaskIds: ["turtle-08", "turtle-12"],
        hint: "Nutze die alten Unterprogramme statt den ganzen Code neu zu schreiben.",
        solution: `Rufe Quadrat auf

stiftHoch()
geheZu(0, 80)
stiftRunter()

Rufe Dreieck auf`,
        requires: {
            sourceIncludes: ["Rufe Quadrat auf", "Rufe Dreieck auf", "geheZu("],
            customCheck: "houseWithSubprograms"
        }
    },

    {
        id: "turtle-14",
        title: "14. Schleife mit Positionswechsel",
        description: `
Zeichne drei Quadrate nebeneinander.

Dazu:
- Quadrat zeichnen
- ohne Zeichnen weiter nach rechts
- wieder Quadrat zeichnen

Ziel:
- Wiederholung plus Positionswechsel
        `.trim(),
        concepts: ["Wiederholung", "Unterprogramme"],
        emptyStarterCode: "",
        helperLabel: "Idee",
        helperSnippet: `Wiederhole 3 Mal
    Rufe Quadrat auf
    stiftHoch()
    geheZu(...)
    stiftRunter()
Ende Wiederhole`,
        referenceTaskIds: ["turtle-08"],
        hint: "Nach jedem Quadrat musst du versetzen, ohne eine Linie zu ziehen.",
        solution: `Ganzzahl x = 0

Wiederhole 3 Mal
    stiftHoch()
    geheZu(x, 0)
    stiftRunter()
    Rufe Quadrat auf
    x = x + 120
Ende Wiederhole`,
        requires: {
            sourceIncludes: ["Wiederhole 3 Mal", "Rufe Quadrat auf", "x = x + 120"],
            customCheck: "threeSquaresRow"
        }
    },

    {
        id: "turtle-15",
        title: "15. Alternative mit zwei Unterprogrammen",
        description: `
Frage eine Ganzzahl form ab.

Wenn form == 1, zeichne ein Quadrat.
Sonst zeichne ein Dreieck.

Ziel:
- Alternative mit bereits bekannten Unterprogrammen
        `.trim(),
        concepts: ["Alternative", "Unterprogramme"],
        emptyStarterCode: "",
        helperLabel: "Struktur",
        helperSnippet: `Eingabe Ganzzahl form

Wenn form == 1 Dann
    Rufe Quadrat auf
Sonst
    Rufe Dreieck auf
Ende Wenn`,
        referenceTaskIds: ["turtle-08", "turtle-12"],
        hint: "Hier musst du nicht die ganze Form neu schreiben, sondern nur die Unterprogramme aufrufen.",
        solution: `Eingabe Ganzzahl form

Wenn form == 1 Dann
    Rufe Quadrat auf
Sonst
    Rufe Dreieck auf
Ende Wenn`,
        requires: {
            sourceIncludes: ["Wenn", "Sonst", "Rufe Quadrat auf", "Rufe Dreieck auf"],
            customCheck: "ifSquareElseTriangleSubprograms"
        }
    },

    {
        id: "turtle-16",
        title: "16. Solange-Schleife",
        description: `
Nutze eine Solange-Schleife, um 5 kleine Schritte zu zeichnen.

Ziel:
- zählgesteuerte Wiederholung mit Variable
        `.trim(),
        concepts: ["Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Schema",
        helperSnippet: `Ganzzahl i = 0

Solange i < 5 gilt
    ...
    i = i + 1
Ende Solange`,
        referenceTaskIds: [],
        hint: "Du brauchst eine Zählvariable, die sich in jeder Runde ändert.",
        solution: `Ganzzahl i = 0

Solange i < 5 gilt
    vorwaerts(40)
    dreheLinks(72)
    i = i + 1
Ende Solange`,
        requires: {
            sourceIncludes: ["Solange", "gilt", "i = i + 1"],
            customCheck: "whileFiveSteps"
        }
    },

    {
        id: "turtle-17",
        title: "17. Stern-Unterprogramm",
        description: `
Lege ein Unterprogramm Stern an.
Es soll einen 5-zackigen Stern zeichnen.

Ziel:
- komplexere Form als Unterprogramm kapseln
        `.trim(),
        concepts: ["Unterprogramme", "Wiederholung"],
        emptyStarterCode: "",
        helperLabel: "Hinweis",
        helperSnippet: `Wiederhole 5 Mal
    vorwaerts(100)
    dreheRechts(144)
Ende Wiederhole`,
        referenceTaskIds: [],
        hint: "Der Stern nutzt 144 Grad.",
        solution: `Rufe Stern auf`,
        requires: {
            sourceIncludes: ["Rufe Stern auf"],
            customCheck: "subprogramStar"
        }
    },

    {
        id: "turtle-18",
        title: "18. Muster mit Stern",
        description: `
Nutze dein Stern-Unterprogramm mehrmals an verschiedenen Positionen.

Ziel:
- Wiederverwendung und Struktur
        `.trim(),
        concepts: ["Unterprogramme", "Sequenz"],
        emptyStarterCode: "",
        helperLabel: "Idee",
        helperSnippet: `Rufe Stern auf

stiftHoch()
geheZu(180, 0)
stiftRunter()

Rufe Stern auf`,
        referenceTaskIds: ["turtle-17"],
        hint: "Zeichne nicht alles doppelt aus – nutze den Aufruf.",
        solution: `Rufe Stern auf

stiftHoch()
geheZu(180, 0)
stiftRunter()

Rufe Stern auf`,
        requires: {
            sourceIncludes: ["Rufe Stern auf", "geheZu("],
            customCheck: "twoStars"
        }
    },

    {
        id: "turtle-19",
        title: "19. Freie Strukturaufgabe",
        description: `
Zeichne ein kleines Bild aus mindestens:
- einer Wiederholung
- einer Alternative
- einem Unterprogramm

Schau dir danach das Struktogramm an.

Ziel:
- Konzepte zusammenführen
        `.trim(),
        concepts: ["Wiederholung", "Alternative", "Unterprogramme", "Struktogramm"],
        emptyStarterCode: "",
        helperLabel: "Mögliche Mindeststruktur",
        helperSnippet: `Rufe Quadrat auf

Ganzzahl form = 1

Wenn form == 1 Dann
    Rufe Dreieck auf
Sonst
    Rufe Stern auf
Ende Wenn`,
        referenceTaskIds: ["turtle-08", "turtle-12", "turtle-17"],
        hint: "Wichtig ist hier nicht ein exaktes Bild, sondern dass alle drei Konzepte sichtbar verwendet werden.",
        solution: `Rufe Quadrat auf

Ganzzahl form = 1

Wenn form == 1 Dann
    Rufe Dreieck auf
Sonst
    Rufe Stern auf
Ende Wenn`,
        requires: {
            sourceIncludes: ["Wenn", "Rufe", "Wiederhole"],
            customCheck: "freeStructureTask"
        }
    },

    {
        id: "turtle-20",
        title: "20. Abschlussbild",
        description: `
Erstelle ein größeres Abschlussbild mit mehreren Turtle-Formen.

Bedingungen:
- mindestens 2 Unterprogramme verwenden
- mindestens 1 Wiederholung verwenden
- mindestens 1 Positionswechsel mit stiftHoch / geheZu / stiftRunter
- danach Struktogramm anschauen

Ziel:
- alles zusammenführen
        `.trim(),
        concepts: ["Sequenz", "Wiederholung", "Alternative", "Unterprogramme", "Struktogramm"],
        emptyStarterCode: "",
        helperLabel: "Mögliche Startidee",
        helperSnippet: `Rufe Quadrat auf

stiftHoch()
geheZu(160, 0)
stiftRunter()

Rufe Stern auf`,
        referenceTaskIds: ["turtle-08", "turtle-12", "turtle-17"],
        hint: "Nutze vorhandene Unterprogramme und baue daraus ein größeres Bild.",
        solution: `Rufe Quadrat auf

stiftHoch()
geheZu(160, 0)
stiftRunter()

Rufe Stern auf`,
        requires: {
            customCheck: "finalProject"
        }
    }
];