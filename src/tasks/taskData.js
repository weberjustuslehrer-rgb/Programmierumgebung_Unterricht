export const tasks = [
    {
        id: "turtle-01",
        title: "1. Erste Schritte",
        description: "Lass die Turtle 100 Schritte vorwärts gehen.",
        starterCode: `vorwaerts(100)`,
        hint: "Nutze den Befehl vorwaerts(100).",
        solution: `vorwaerts(100)`,
        expected: {
            commands: [
                { type: "forward", value: 100 }
            ]
        }
    },
    {
        id: "turtle-02",
        title: "2. Rechter Winkel",
        description: "Zeichne 100 Schritte vorwärts, drehe dich um 90 Grad nach links und gehe nochmal 100 Schritte vorwärts.",
        starterCode: `vorwaerts(100)
dreheLinks(90)
vorwaerts(100)`,
        hint: "Ein rechter Winkel hat 90 Grad.",
        solution: `vorwaerts(100)
dreheLinks(90)
vorwaerts(100)`,
        expected: {
            commands: [
                { type: "forward", value: 100 },
                { type: "left", value: 90 },
                { type: "forward", value: 100 }
            ]
        }
    }
];