/* =====================================================================
 * names.js — 250 bot names for randomization
 * ===================================================================== */
(function (global) {
    'use strict';
    const BOT_NAMES = [
        "Eden", "Aria", "Nova", "Luna", "Orion", "Iris", "Atlas", "Sage", "Rhea", "Axel",
        "Zara", "Finn", "Nyx", "Leo", "Mira", "Kai", "Vera", "Onyx", "Isla", "Rex",
        "Cleo", "Jax", "Wren", "Cyrus", "Elara", "Knox", "Lyra", "Dante", "Freya", "Nico",
        "Selene", "Omar", "Thalia", "Rhys", "Aurora", "Zane", "Maeve", "Cruz", "Nadia", "Silas",
        "Esme", "Titus", "Lior", "Ronan", "Indra", "Cato", "Yara", "Bram", "Opal", "Dax",
        "Ivy", "Enzo", "Suki", "Hugo", "Leia", "Ravi", "Nell", "Otto", "Pia", "Milo",
        "Sana", "Ezra", "Tess", "Arlo", "Juno", "Beck", "Faye", "Corbin", "Lena", "Dorian",
        "Rosa", "Emil", "Gia", "Felix", "Anya", "Galen", "Mira", "Hale", "Nora", "Ivo",
        "Odette", "Jules", "Pearl", "Kiran", "Quinn", "Lars", "Ruth", "Moss", "Sylvie", "Niall",
        "Tara", "Oren", "Uma", "Pax", "Veda", "Quincy", "Willa", "Reed", "Xena", "Soren",
        "Yvonne", "Talon", "Zelda", "Uriel", "Adele", "Vince", "Bree", "Wade", "Calla", "Xander",
        "Dara", "Yale", "Elsa", "Zeke", "Fiona", "Abe", "Greta", "Blaise", "Hilda", "Cade",
        "Ines", "Drew", "Jade", "Eli", "Kira", "Flint", "Lila", "Gus", "Mona", "Hank",
        "Nina", "Ike", "Olive", "Jack", "Pippa", "Kit", "Rina", "Landon", "Sina", "Marlow",
        "Tina", "Noel", "Ula", "Oscar", "Vivi", "Pete", "Wendy", "Quill", "Xia", "Rory",
        "Yuki", "Sam", "Zoe", "Toby", "Ada", "Umar", "Bea", "Vik", "Cora", "Wes",
        "Dina", "Xavi", "Etta", "Yosef", "Fleur", "Zion", "Gwen", "Alfie", "Hana", "Bo",
        "Ida", "Caleb", "June", "Dale", "Karla", "Emmett", "Lola", "Franz", "Maya", "Gideon",
        "Nia", "Hector", "Oona", "Ira", "Pia", "Jonas", "Rhea", "Kurt", "Sia", "Levi",
        "Tia", "Marcus", "Una", "Nate", "Vera", "Otis", "Willa", "Percy", "Xyla", "Quin",
        "Yara", "Rolf", "Zara", "Sven", "Alma", "Theo", "Bina", "Ugo", "Cleo", "Vito",
        "Dora", "Walt", "Elin", "Xeno", "Fara", "Yves", "Gina", "Zeno", "Hebe", "Argo",
        "Ilse", "Brio", "Jana", "Ciro", "Kena", "Dino", "Lina", "Egon", "Mina", "Faro",
        "Nora", "Giro", "Oria", "Halo", "Pina", "Ivo", "Qira", "Jaro", "Rina", "Keno",
        "Sena", "Lumo", "Tova", "Miro", "Uria", "Nero", "Vina", "Orio", "Wena", "Pico",
        "Xara", "Quilo", "Yena", "Rilo", "Zira", "Silo", "Amina", "Tilo", "Bena", "Ulo",
        "Cena", "Vilo", "Dena", "Wilo", "Ena", "Xilo", "Fena", "Yilo", "Gena", "Zilo"
    ];

    global.NameHandler = {
        getRandomName: function () {
            return BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);