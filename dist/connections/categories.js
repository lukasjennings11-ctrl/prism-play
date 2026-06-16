/* shared/categories.js — embedded category pool for Groups (no external CDN).
 * Each category is a theme name + 4 words. Every word is unique across the
 * entire pool to avoid cross-category ambiguity. A round picks 4 categories
 * (16 words total), shuffles them together, and the player has to regroup them.
 */
(function (global) {
  'use strict';

  var CATEGORIES = [
    { name: 'Primary colors',  words: ['RED', 'BLUE', 'YELLOW', 'GREEN'] },
    { name: 'Days of the week', words: ['MONDAY', 'TUESDAY', 'FRIDAY', 'SUNDAY'] },
    { name: 'Fruits',          words: ['APPLE', 'MANGO', 'GRAPE', 'PEACH'] },
    { name: 'Planets',         words: ['MARS', 'VENUS', 'EARTH', 'PLUTO'] },
    { name: 'Oceans',          words: ['PACIFIC', 'ATLANTIC', 'INDIAN', 'ARCTIC'] },
    { name: 'Card suits',      words: ['HEARTS', 'CLUBS', 'SPADES', 'DIAMONDS'] },
    { name: 'Chess pieces',    words: ['KNIGHT', 'BISHOP', 'ROOK', 'QUEEN'] },
    { name: 'Metals',          words: ['GOLD', 'SILVER', 'COPPER', 'IRON'] },
    { name: 'Big cats',        words: ['LION', 'TIGER', 'JAGUAR', 'PANTHER'] },
    { name: 'Birds',           words: ['EAGLE', 'ROBIN', 'SPARROW', 'FALCON'] },
    { name: 'Instruments',     words: ['PIANO', 'VIOLIN', 'FLUTE', 'DRUMS'] },
    { name: 'Seasons',         words: ['SPRING', 'SUMMER', 'AUTUMN', 'WINTER'] },
    { name: 'Shapes',          words: ['CIRCLE', 'SQUARE', 'TRIANGLE', 'OCTAGON'] },
    { name: 'Gemstones',       words: ['RUBY', 'EMERALD', 'TOPAZ', 'OPAL'] },
    { name: 'Hand tools',      words: ['HAMMER', 'WRENCH', 'CHISEL', 'PLIERS'] },
    { name: 'Desserts',        words: ['CAKE', 'PIE', 'MOUSSE', 'SORBET'] },
    { name: 'Weather',         words: ['RAIN', 'SNOW', 'HAIL', 'FOG'] },
    { name: 'Dance styles',    words: ['SALSA', 'TANGO', 'WALTZ', 'BALLET'] },
    { name: 'Board games',     words: ['CHESS', 'RISK', 'CLUE', 'SORRY'] },
    { name: 'Constellations',  words: ['ORION', 'LYRA', 'DRACO', 'HYDRA'] },
    { name: 'Herbs',           words: ['BASIL', 'THYME', 'SAGE', 'MINT'] },
    { name: 'Tree types',      words: ['OAK', 'PINE', 'MAPLE', 'BIRCH'] },
    { name: 'Spices',          words: ['CUMIN', 'CLOVE', 'NUTMEG', 'PAPRIKA'] },
    { name: 'Currencies',      words: ['EURO', 'YEN', 'PESO', 'RUPEE'] },
    { name: 'Card games',      words: ['POKER', 'BRIDGE', 'RUMMY', 'EUCHRE'] },
    { name: 'Sandwiches',      words: ['REUBEN', 'PANINI', 'GYRO', 'HOAGIE'] },
    { name: 'Soups',           words: ['BISQUE', 'CHOWDER', 'GUMBO', 'BROTH'] },
    { name: 'Pasta shapes',    words: ['PENNE', 'FUSILLI', 'ORZO', 'RAVIOLI'] },
    { name: 'Hats',            words: ['BERET', 'FEDORA', 'BEANIE', 'VISOR'] },
    { name: 'Footwear',        words: ['SANDAL', 'LOAFER', 'SNEAKER', 'CLOG'] },
    { name: 'Rivers',          words: ['NILE', 'AMAZON', 'THAMES', 'DANUBE'] },
    { name: 'Mountains',       words: ['EVEREST', 'DENALI', 'KILIMANJARO', 'MATTERHORN'] },
    { name: 'Languages',       words: ['FRENCH', 'SWAHILI', 'MANDARIN', 'HINDI'] },
    { name: 'Martial arts',    words: ['KARATE', 'JUDO', 'AIKIDO', 'KENDO'] },
    { name: 'Yoga poses',      words: ['COBRA', 'LOTUS', 'CAMEL', 'PIGEON'] },
    { name: 'Knot types',      words: ['BOWLINE', 'HITCH', 'NOOSE', 'SHEEPSHANK'] },
    { name: 'Coffee drinks',   words: ['LATTE', 'MOCHA', 'CORTADO', 'AMERICANO'] },
    { name: 'Pizza toppings',  words: ['PEPPERONI', 'OLIVE', 'ANCHOVY', 'ARUGULA'] },
    { name: 'Building materials', words: ['BRICK', 'CONCRETE', 'TIMBER', 'GRANITE'] },
    { name: 'Butterflies & moths', words: ['MONARCH', 'LUNA', 'SWALLOWTAIL', 'ATLAS'] }
  ];

  global.CATEGORIES = CATEGORIES;
})(window);
