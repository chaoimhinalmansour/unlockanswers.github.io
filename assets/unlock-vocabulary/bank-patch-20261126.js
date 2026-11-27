"use strict";

(() => {
  const root = new URL(".", document.currentScript.src);
  const published = window.UNLOCK_VOCABULARY_CATALOG;
  const catalog = Object.freeze({
    "B01-RW-U01": {
      "id": "B01-RW-U01",
      "book": 1,
      "unit": 1,
      "track": "RW",
      "topic": "PEOPLE",
      "revision": "f0e6d81e4f52bd7e",
      "count": 27,
      "file": "banks/B01-RW-U01-f0e6d81e4f52bd7e.json"
    },
    "B01-LS-U01": {
      "id": "B01-LS-U01",
      "book": 1,
      "unit": 1,
      "track": "LS",
      "topic": "PEOPLE",
      "revision": "64697c31761336ec",
      "count": 14,
      "file": "banks/B01-LS-U01-64697c31761336ec.json"
    },
    "B01-RW-U02": {
      "id": "B01-RW-U02",
      "book": 1,
      "unit": 2,
      "track": "RW",
      "topic": "SEASONS",
      "revision": "e88d0a103c1d60e5",
      "count": 14,
      "file": "banks/B01-RW-U02-e88d0a103c1d60e5.json"
    },
    "B01-LS-U02": {
      "id": "B01-LS-U02",
      "book": 1,
      "unit": 2,
      "track": "LS",
      "topic": "SEASONS",
      "revision": "3dc297e0f567caf0",
      "count": 42,
      "file": "banks/B01-LS-U02-3dc297e0f567caf0.json"
    },
    "B01-RW-U03": {
      "id": "B01-RW-U03",
      "book": 1,
      "unit": 3,
      "track": "RW",
      "topic": "LIFESTYLE",
      "revision": "264402cd539337d2",
      "count": 35,
      "file": "banks/B01-RW-U03-264402cd539337d2.json"
    },
    "B01-LS-U03": {
      "id": "B01-LS-U03",
      "book": 1,
      "unit": 3,
      "track": "LS",
      "topic": "LIFESTYLE",
      "revision": "69893da087b9b8e7",
      "count": 36,
      "file": "banks/B01-LS-U03-69893da087b9b8e7.json"
    },
    "B01-RW-U04": {
      "id": "B01-RW-U04",
      "book": 1,
      "unit": 4,
      "track": "RW",
      "topic": "PLACES",
      "revision": "6f45188be1063a00",
      "count": 25,
      "file": "banks/B01-RW-U04-6f45188be1063a00.json"
    },
    "B01-LS-U04": {
      "id": "B01-LS-U04",
      "book": 1,
      "unit": 4,
      "track": "LS",
      "topic": "PLACES",
      "revision": "ac62a2ce658e77fd",
      "count": 27,
      "file": "banks/B01-LS-U04-ac62a2ce658e77fd.json"
    },
    "B01-RW-U05": {
      "id": "B01-RW-U05",
      "book": 1,
      "unit": 5,
      "track": "RW",
      "topic": "JOBS",
      "revision": "ab08727b4b686e45",
      "count": 26,
      "file": "banks/B01-RW-U05-ab08727b4b686e45.json"
    },
    "B01-LS-U05": {
      "id": "B01-LS-U05",
      "book": 1,
      "unit": 5,
      "track": "LS",
      "topic": "JOBS",
      "revision": "ca89575e124a82b6",
      "count": 13,
      "file": "banks/B01-LS-U05-ca89575e124a82b6.json"
    },
    "B01-RW-U06": {
      "id": "B01-RW-U06",
      "book": 1,
      "unit": 6,
      "track": "RW",
      "topic": "HOMES AND BUILDINGS",
      "revision": "7134b468075dd80e",
      "count": 35,
      "file": "banks/B01-RW-U06-7134b468075dd80e.json"
    },
    "B01-LS-U06": {
      "id": "B01-LS-U06",
      "book": 1,
      "unit": 6,
      "track": "LS",
      "topic": "HOMES AND BUILDINGS",
      "revision": "45c143218572f1a1",
      "count": 32,
      "file": "banks/B01-LS-U06-45c143218572f1a1.json"
    },
    "B01-RW-U07": {
      "id": "B01-RW-U07",
      "book": 1,
      "unit": 7,
      "track": "RW",
      "topic": "FOOD AND CULTURE",
      "revision": "46f1f9c9064e71b9",
      "count": 29,
      "file": "banks/B01-RW-U07-46f1f9c9064e71b9.json"
    },
    "B01-LS-U07": {
      "id": "B01-LS-U07",
      "book": 1,
      "unit": 7,
      "track": "LS",
      "topic": "FOOD AND CULTURE",
      "revision": "43d86219520058cf",
      "count": 21,
      "file": "banks/B01-LS-U07-43d86219520058cf.json"
    },
    "B01-RW-U08": {
      "id": "B01-RW-U08",
      "book": 1,
      "unit": 8,
      "track": "RW",
      "topic": "TRANSPORT",
      "revision": "cf8d2396b5827a34",
      "count": 22,
      "file": "banks/B01-RW-U08-cf8d2396b5827a34.json"
    },
    "B01-LS-U08": {
      "id": "B01-LS-U08",
      "book": 1,
      "unit": 8,
      "track": "LS",
      "topic": "TRANSPORT",
      "revision": "2ede0c92efe464da",
      "count": 20,
      "file": "banks/B01-LS-U08-2ede0c92efe464da.json"
    },
    "B02-RW-U01": {
      "id": "B02-RW-U01",
      "book": 2,
      "unit": 1,
      "track": "RW",
      "topic": "PLACES",
      "revision": "f5ab600e20b53b3e",
      "count": 21,
      "file": "banks/B02-RW-U01-f5ab600e20b53b3e.json"
    },
    "B02-LS-U01": {
      "id": "B02-LS-U01",
      "book": 2,
      "unit": 1,
      "track": "LS",
      "topic": "PLACES",
      "revision": "cfdd8ec35ca6c3c1",
      "count": 21,
      "file": "banks/B02-LS-U01-cfdd8ec35ca6c3c1.json"
    },
    "B02-RW-U02": {
      "id": "B02-RW-U02",
      "book": 2,
      "unit": 2,
      "track": "RW",
      "topic": "FESTIVALS AND CELEBRATIONS",
      "revision": "c9d1d02b7ca52387",
      "count": 12,
      "file": "banks/B02-RW-U02-c9d1d02b7ca52387.json"
    },
    "B02-LS-U02": {
      "id": "B02-LS-U02",
      "book": 2,
      "unit": 2,
      "track": "LS",
      "topic": "FESTIVALS AND CELEBRATIONS",
      "revision": "62a93cdef28c2916",
      "count": 28,
      "file": "banks/B02-LS-U02-62a93cdef28c2916.json"
    },
    "B02-RW-U03": {
      "id": "B02-RW-U03",
      "book": 2,
      "unit": 3,
      "track": "RW",
      "topic": "THE INTERNET AND TECHNOLOGY",
      "revision": "b9602bb939abe303",
      "count": 19,
      "file": "banks/B02-RW-U03-b9602bb939abe303.json"
    },
    "B02-LS-U03": {
      "id": "B02-LS-U03",
      "book": 2,
      "unit": 3,
      "track": "LS",
      "topic": "THE INTERNET AND TECHNOLOGY",
      "revision": "2250cafe157ef0cd",
      "count": 38,
      "file": "banks/B02-LS-U03-2250cafe157ef0cd.json"
    },
    "B02-RW-U04": {
      "id": "B02-RW-U04",
      "book": 2,
      "unit": 4,
      "track": "RW",
      "topic": "WEATHER AND CLIMATE",
      "revision": "1f1b96ae6672414c",
      "count": 21,
      "file": "banks/B02-RW-U04-1f1b96ae6672414c.json"
    },
    "B02-LS-U04": {
      "id": "B02-LS-U04",
      "book": 2,
      "unit": 4,
      "track": "LS",
      "topic": "WEATHER AND CLIMATE",
      "revision": "78252b876ab66903",
      "count": 20,
      "file": "banks/B02-LS-U04-78252b876ab66903.json"
    },
    "B02-RW-U05": {
      "id": "B02-RW-U05",
      "book": 2,
      "unit": 5,
      "track": "RW",
      "topic": "SPORTS AND COMPETITION",
      "revision": "b879fa901acf7a13",
      "count": 13,
      "file": "banks/B02-RW-U05-b879fa901acf7a13.json"
    },
    "B02-LS-U05": {
      "id": "B02-LS-U05",
      "book": 2,
      "unit": 5,
      "track": "LS",
      "topic": "SPORTS AND COMPETITION",
      "revision": "5c895a30b9f771aa",
      "count": 14,
      "file": "banks/B02-LS-U05-5c895a30b9f771aa.json"
    },
    "B02-RW-U06": {
      "id": "B02-RW-U06",
      "book": 2,
      "unit": 6,
      "track": "RW",
      "topic": "BUSINESS",
      "revision": "ff2438ade162d3a4",
      "count": 22,
      "file": "banks/B02-RW-U06-ff2438ade162d3a4.json"
    },
    "B02-LS-U06": {
      "id": "B02-LS-U06",
      "book": 2,
      "unit": 6,
      "track": "LS",
      "topic": "BUSINESS",
      "revision": "1809fc11fd3224cd",
      "count": 22,
      "file": "banks/B02-LS-U06-1809fc11fd3224cd.json"
    },
    "B02-RW-U07": {
      "id": "B02-RW-U07",
      "book": 2,
      "unit": 7,
      "track": "RW",
      "topic": "PEOPLE",
      "revision": "150dbb8bcdbacae5",
      "count": 27,
      "file": "banks/B02-RW-U07-150dbb8bcdbacae5.json"
    },
    "B02-LS-U07": {
      "id": "B02-LS-U07",
      "book": 2,
      "unit": 7,
      "track": "LS",
      "topic": "PEOPLE",
      "revision": "7ed0b6c351f5dac2",
      "count": 33,
      "file": "banks/B02-LS-U07-7ed0b6c351f5dac2.json"
    },
    "B02-RW-U08": {
      "id": "B02-RW-U08",
      "book": 2,
      "unit": 8,
      "track": "RW",
      "topic": "THE UNIVERSE",
      "revision": "72f6963891595ba5",
      "count": 20,
      "file": "banks/B02-RW-U08-72f6963891595ba5.json"
    },
    "B02-LS-U08": {
      "id": "B02-LS-U08",
      "book": 2,
      "unit": 8,
      "track": "LS",
      "topic": "THE UNIVERSE",
      "revision": "528bee93b98db8de",
      "count": 19,
      "file": "banks/B02-LS-U08-528bee93b98db8de.json"
    },
    "B03-RW-U01": {
      "id": "B03-RW-U01",
      "book": 3,
      "unit": 1,
      "track": "RW",
      "topic": "ANIMALS",
      "revision": "1621acd2cefc4f2e",
      "count": 21,
      "file": "banks/B03-RW-U01-1621acd2cefc4f2e.json"
    },
    "B03-LS-U01": {
      "id": "B03-LS-U01",
      "book": 3,
      "unit": 1,
      "track": "LS",
      "topic": "ANIMALS",
      "revision": "a75723e771139f09",
      "count": 27,
      "file": "banks/B03-LS-U01-a75723e771139f09.json"
    },
    "B03-RW-U02": {
      "id": "B03-RW-U02",
      "book": 3,
      "unit": 2,
      "track": "RW",
      "topic": "THE ENVIRONMENT",
      "revision": "e73d271619418634",
      "count": 23,
      "file": "banks/B03-RW-U02-e73d271619418634.json"
    },
    "B03-LS-U02": {
      "id": "B03-LS-U02",
      "book": 3,
      "unit": 2,
      "track": "LS",
      "topic": "THE ENVIRONMENT",
      "revision": "2712e5fd1768a43a",
      "count": 15,
      "file": "banks/B03-LS-U02-2712e5fd1768a43a.json"
    },
    "B03-RW-U03": {
      "id": "B03-RW-U03",
      "book": 3,
      "unit": 3,
      "track": "RW",
      "topic": "TRANSPORT",
      "revision": "b3593a8a26cc648a",
      "count": 23,
      "file": "banks/B03-RW-U03-b3593a8a26cc648a.json"
    },
    "B03-LS-U03": {
      "id": "B03-LS-U03",
      "book": 3,
      "unit": 3,
      "track": "LS",
      "topic": "TRANSPORT",
      "revision": "ff3103c3faa386d7",
      "count": 24,
      "file": "banks/B03-LS-U03-ff3103c3faa386d7.json"
    },
    "B03-RW-U04": {
      "id": "B03-RW-U04",
      "book": 3,
      "unit": 4,
      "track": "RW",
      "topic": "CUSTOMS AND TRADITIONS",
      "revision": "2e3bcc24fae8d4c2",
      "count": 21,
      "file": "banks/B03-RW-U04-2e3bcc24fae8d4c2.json"
    },
    "B03-LS-U04": {
      "id": "B03-LS-U04",
      "book": 3,
      "unit": 4,
      "track": "LS",
      "topic": "CUSTOMS AND TRADITIONS",
      "revision": "5097879588f093e0",
      "count": 25,
      "file": "banks/B03-LS-U04-5097879588f093e0.json"
    },
    "B03-RW-U05": {
      "id": "B03-RW-U05",
      "book": 3,
      "unit": 5,
      "track": "RW",
      "topic": "HEALTH AND FITNESS",
      "revision": "1ceb9ff0b32ca865",
      "count": 21,
      "file": "banks/B03-RW-U05-1ceb9ff0b32ca865.json"
    },
    "B03-LS-U05": {
      "id": "B03-LS-U05",
      "book": 3,
      "unit": 5,
      "track": "LS",
      "topic": "HEALTH AND FITNESS",
      "revision": "63962666d75a3479",
      "count": 31,
      "file": "banks/B03-LS-U05-63962666d75a3479.json"
    },
    "B03-RW-U06": {
      "id": "B03-RW-U06",
      "book": 3,
      "unit": 6,
      "track": "RW",
      "topic": "DISCOVERY AND INVENTION",
      "revision": "22434c6ba6f63a4d",
      "count": 19,
      "file": "banks/B03-RW-U06-22434c6ba6f63a4d.json"
    },
    "B03-LS-U06": {
      "id": "B03-LS-U06",
      "book": 3,
      "unit": 6,
      "track": "LS",
      "topic": "DISCOVERY AND INVENTION",
      "revision": "7b68cac1783ef04e",
      "count": 24,
      "file": "banks/B03-LS-U06-7b68cac1783ef04e.json"
    },
    "B03-RW-U07": {
      "id": "B03-RW-U07",
      "book": 3,
      "unit": 7,
      "track": "RW",
      "topic": "FASHION",
      "revision": "5718818cce582268",
      "count": 21,
      "file": "banks/B03-RW-U07-5718818cce582268.json"
    },
    "B03-LS-U07": {
      "id": "B03-LS-U07",
      "book": 3,
      "unit": 7,
      "track": "LS",
      "topic": "FASHION",
      "revision": "cbef56fe04346b23",
      "count": 18,
      "file": "banks/B03-LS-U07-cbef56fe04346b23.json"
    },
    "B03-RW-U08": {
      "id": "B03-RW-U08",
      "book": 3,
      "unit": 8,
      "track": "RW",
      "topic": "ECONOMICS",
      "revision": "2d3f790b3bf024e8",
      "count": 26,
      "file": "banks/B03-RW-U08-2d3f790b3bf024e8.json"
    },
    "B03-LS-U08": {
      "id": "B03-LS-U08",
      "book": 3,
      "unit": 8,
      "track": "LS",
      "topic": "ECONOMICS",
      "revision": "4eee1d0c14f755e1",
      "count": 27,
      "file": "banks/B03-LS-U08-4eee1d0c14f755e1.json"
    },
    "B04-RW-U01": {
      "id": "B04-RW-U01",
      "book": 4,
      "unit": 1,
      "track": "RW",
      "topic": "GLOBALIZATION",
      "revision": "2555365df4c039bf",
      "count": 25,
      "file": "banks/B04-RW-U01-2555365df4c039bf.json"
    },
    "B04-LS-U01": {
      "id": "B04-LS-U01",
      "book": 4,
      "unit": 1,
      "track": "LS",
      "topic": "GLOBALIZATION",
      "revision": "c9def70747aff676",
      "count": 21,
      "file": "banks/B04-LS-U01-c9def70747aff676.json"
    },
    "B04-RW-U02": {
      "id": "B04-RW-U02",
      "book": 4,
      "unit": 2,
      "track": "RW",
      "topic": "EDUCATION",
      "revision": "915475610c56663a",
      "count": 39,
      "file": "banks/B04-RW-U02-915475610c56663a.json"
    },
    "B04-LS-U02": {
      "id": "B04-LS-U02",
      "book": 4,
      "unit": 2,
      "track": "LS",
      "topic": "EDUCATION",
      "revision": "c42f417501fce0f0",
      "count": 16,
      "file": "banks/B04-LS-U02-c42f417501fce0f0.json"
    },
    "B04-RW-U03": {
      "id": "B04-RW-U03",
      "book": 4,
      "unit": 3,
      "track": "RW",
      "topic": "MEDICINE",
      "revision": "26725b4a04eec4e5",
      "count": 37,
      "file": "banks/B04-RW-U03-26725b4a04eec4e5.json"
    },
    "B04-LS-U03": {
      "id": "B04-LS-U03",
      "book": 4,
      "unit": 3,
      "track": "LS",
      "topic": "MEDICINE",
      "revision": "cd8edea94de974c0",
      "count": 24,
      "file": "banks/B04-LS-U03-cd8edea94de974c0.json"
    },
    "B04-RW-U04": {
      "id": "B04-RW-U04",
      "book": 4,
      "unit": 4,
      "track": "RW",
      "topic": "THE ENVIRONMENT",
      "revision": "0d601f25f5b275f8",
      "count": 20,
      "file": "banks/B04-RW-U04-0d601f25f5b275f8.json"
    },
    "B04-LS-U04": {
      "id": "B04-LS-U04",
      "book": 4,
      "unit": 4,
      "track": "LS",
      "topic": "THE ENVIRONMENT",
      "revision": "98f607fe94d2acd5",
      "count": 22,
      "file": "banks/B04-LS-U04-98f607fe94d2acd5.json"
    },
    "B04-RW-U05": {
      "id": "B04-RW-U05",
      "book": 4,
      "unit": 5,
      "track": "RW",
      "topic": "ARCHITECTURE",
      "revision": "55076cf48f5f2c52",
      "count": 33,
      "file": "banks/B04-RW-U05-55076cf48f5f2c52.json"
    },
    "B04-LS-U05": {
      "id": "B04-LS-U05",
      "book": 4,
      "unit": 5,
      "track": "LS",
      "topic": "ARCHITECTURE",
      "revision": "835bbd0223a47dd9",
      "count": 23,
      "file": "banks/B04-LS-U05-835bbd0223a47dd9.json"
    },
    "B04-RW-U06": {
      "id": "B04-RW-U06",
      "book": 4,
      "unit": 6,
      "track": "RW",
      "topic": "ENERGY",
      "revision": "ada44943ae0c7b0f",
      "count": 15,
      "file": "banks/B04-RW-U06-ada44943ae0c7b0f.json"
    },
    "B04-LS-U06": {
      "id": "B04-LS-U06",
      "book": 4,
      "unit": 6,
      "track": "LS",
      "topic": "ENERGY",
      "revision": "b3449461a0a65208",
      "count": 25,
      "file": "banks/B04-LS-U06-b3449461a0a65208.json"
    },
    "B04-RW-U07": {
      "id": "B04-RW-U07",
      "book": 4,
      "unit": 7,
      "track": "RW",
      "topic": "ART AND DESIGN",
      "revision": "c8f29e1d04548584",
      "count": 20,
      "file": "banks/B04-RW-U07-c8f29e1d04548584.json"
    },
    "B04-LS-U07": {
      "id": "B04-LS-U07",
      "book": 4,
      "unit": 7,
      "track": "LS",
      "topic": "ART AND DESIGN",
      "revision": "305529a0f1b10314",
      "count": 16,
      "file": "banks/B04-LS-U07-305529a0f1b10314.json"
    },
    "B04-RW-U08": {
      "id": "B04-RW-U08",
      "book": 4,
      "unit": 8,
      "track": "RW",
      "topic": "AGEING",
      "revision": "402df6cbe8c8f86c",
      "count": 18,
      "file": "banks/B04-RW-U08-402df6cbe8c8f86c.json"
    },
    "B04-LS-U08": {
      "id": "B04-LS-U08",
      "book": 4,
      "unit": 8,
      "track": "LS",
      "topic": "AGEING",
      "revision": "17b877525094108f",
      "count": 24,
      "file": "banks/B04-LS-U08-17b877525094108f.json"
    },
    "B05-RW-U01": {
      "id": "B05-RW-U01",
      "book": 5,
      "unit": 1,
      "track": "RW",
      "topic": "CONSERVATION",
      "revision": "7bb23af19453d382",
      "count": 23,
      "file": "banks/B05-RW-U01-7bb23af19453d382.json"
    },
    "B05-LS-U01": {
      "id": "B05-LS-U01",
      "book": 5,
      "unit": 1,
      "track": "LS",
      "topic": "CONSERVATION",
      "revision": "6317b6b344b97be1",
      "count": 28,
      "file": "banks/B05-LS-U01-6317b6b344b97be1.json"
    },
    "B05-RW-U02": {
      "id": "B05-RW-U02",
      "book": 5,
      "unit": 2,
      "track": "RW",
      "topic": "DESIGN",
      "revision": "45421a9273e8ae2d",
      "count": 25,
      "file": "banks/B05-RW-U02-45421a9273e8ae2d.json"
    },
    "B05-LS-U02": {
      "id": "B05-LS-U02",
      "book": 5,
      "unit": 2,
      "track": "LS",
      "topic": "DESIGN",
      "revision": "95e0e6d627d45b07",
      "count": 16,
      "file": "banks/B05-LS-U02-95e0e6d627d45b07.json"
    },
    "B05-RW-U03": {
      "id": "B05-RW-U03",
      "book": 5,
      "unit": 3,
      "track": "RW",
      "topic": "PRIVACY",
      "revision": "1735bb19c93fee14",
      "count": 21,
      "file": "banks/B05-RW-U03-1735bb19c93fee14.json"
    },
    "B05-LS-U03": {
      "id": "B05-LS-U03",
      "book": 5,
      "unit": 3,
      "track": "LS",
      "topic": "PRIVACY",
      "revision": "8308ce9385dd975b",
      "count": 29,
      "file": "banks/B05-LS-U03-8308ce9385dd975b.json"
    },
    "B05-RW-U04": {
      "id": "B05-RW-U04",
      "book": 5,
      "unit": 4,
      "track": "RW",
      "topic": "BUSINESS",
      "revision": "5885b408ab9d8087",
      "count": 24,
      "file": "banks/B05-RW-U04-5885b408ab9d8087.json"
    },
    "B05-LS-U04": {
      "id": "B05-LS-U04",
      "book": 5,
      "unit": 4,
      "track": "LS",
      "topic": "BUSINESS",
      "revision": "d9fbdfb3614eb8a1",
      "count": 22,
      "file": "banks/B05-LS-U04-d9fbdfb3614eb8a1.json"
    },
    "B05-RW-U05": {
      "id": "B05-RW-U05",
      "book": 5,
      "unit": 5,
      "track": "RW",
      "topic": "PSYCHOLOGY",
      "revision": "7c3e8db21cd84197",
      "count": 23,
      "file": "banks/B05-RW-U05-7c3e8db21cd84197.json"
    },
    "B05-LS-U05": {
      "id": "B05-LS-U05",
      "book": 5,
      "unit": 5,
      "track": "LS",
      "topic": "PSYCHOLOGY",
      "revision": "dd4b65a78c45725f",
      "count": 27,
      "file": "banks/B05-LS-U05-dd4b65a78c45725f.json"
    },
    "B05-RW-U06": {
      "id": "B05-RW-U06",
      "book": 5,
      "unit": 6,
      "track": "RW",
      "topic": "CAREERS",
      "revision": "cd7fa56cf2342377",
      "count": 23,
      "file": "banks/B05-RW-U06-cd7fa56cf2342377.json"
    },
    "B05-LS-U06": {
      "id": "B05-LS-U06",
      "book": 5,
      "unit": 6,
      "track": "LS",
      "topic": "CAREERS",
      "revision": "ba6155a068fa558e",
      "count": 16,
      "file": "banks/B05-LS-U06-ba6155a068fa558e.json"
    },
    "B05-RW-U07": {
      "id": "B05-RW-U07",
      "book": 5,
      "unit": 7,
      "track": "RW",
      "topic": "HEALTH SCIENCES",
      "revision": "80c049122257b773",
      "count": 34,
      "file": "banks/B05-RW-U07-80c049122257b773.json"
    },
    "B05-LS-U07": {
      "id": "B05-LS-U07",
      "book": 5,
      "unit": 7,
      "track": "LS",
      "topic": "HEALTH SCIENCES",
      "revision": "573d79798a929b26",
      "count": 26,
      "file": "banks/B05-LS-U07-573d79798a929b26.json"
    },
    "B05-RW-U08": {
      "id": "B05-RW-U08",
      "book": 5,
      "unit": 8,
      "track": "RW",
      "topic": "COLLABORATION",
      "revision": "52821491629d3df6",
      "count": 28,
      "file": "banks/B05-RW-U08-52821491629d3df6.json"
    },
    "B05-LS-U08": {
      "id": "B05-LS-U08",
      "book": 5,
      "unit": 8,
      "track": "LS",
      "topic": "COLLABORATION",
      "revision": "e8421f14ab6787c8",
      "count": 17,
      "file": "banks/B05-LS-U08-e8421f14ab6787c8.json"
    },
    "B05-RW-U09": {
      "id": "B05-RW-U09",
      "book": 5,
      "unit": 9,
      "track": "RW",
      "topic": "TECHNOLOGY",
      "revision": "3128a78cf6910380",
      "count": 22,
      "file": "banks/B05-RW-U09-3128a78cf6910380.json"
    },
    "B05-LS-U09": {
      "id": "B05-LS-U09",
      "book": 5,
      "unit": 9,
      "track": "LS",
      "topic": "TECHNOLOGY",
      "revision": "4c4980e61b43c59b",
      "count": 41,
      "file": "banks/B05-LS-U09-4c4980e61b43c59b.json"
    },
    "B05-RW-U10": {
      "id": "B05-RW-U10",
      "book": 5,
      "unit": 10,
      "track": "RW",
      "topic": "LANGUAGE",
      "revision": "f866f8c1f98db08b",
      "count": 38,
      "file": "banks/B05-RW-U10-f866f8c1f98db08b.json"
    },
    "B05-LS-U10": {
      "id": "B05-LS-U10",
      "book": 5,
      "unit": 10,
      "track": "LS",
      "topic": "LANGUAGE",
      "revision": "19fd9927968f8ed3",
      "count": 23,
      "file": "banks/B05-LS-U10-19fd9927968f8ed3.json"
    }
  });

  function entry(id, revision) {
    const current = Object.hasOwn(catalog, id) ? catalog[id] : null;
    if (revision === undefined || current?.revision === revision) return current;
    const previous = Object.hasOwn(published, id) ? published[id] : null;
    return previous?.revision === revision ? previous : null;
  }

  const roleNames = new Map([
    ["n", ["Noun", "名词"]], ["v", ["Verb", "动词"]],
    ["adj", ["Adjective", "形容词"]], ["adv", ["Adverb", "副词"]],
    ["prep", ["Preposition", "介词"]], ["phr v", ["Phrasal Verb", "短语动词"]],
  ]);

  function playLabel(role) {
    const names = roleNames.get(role);
    return names ? ["Play " + names[0], "播放" + names[1] + "读音"]
      : role ? ["Play " + role + ".", "播放 " + role + " 读音"] : ["Play Word", "播放单词"];
  }

  function wordPronunciations(cards) {
    const byWord = new Map();
    const wordKey = word => word.normalize("NFKC").toLowerCase().replace(/’/g, "'").trim();
    const soundKey = ipa => ipa.replace(/[.\s/]/g, "").replace(/ɡ/g, "g");
    const defaultAudio = card => ({
      pos: card.pos, ipa: card.ipa, audio: card.wordAudio, meaning: card.translation, definition: card.definition,
    });
    for (const card of cards) {
      const key = wordKey(card.word);
      const roles = byWord.get(key) || new Map();
      for (const reading of card.pronunciations || [defaultAudio(card)]) {
        if (reading.ipa && reading.audio && !roles.has(reading.pos)) roles.set(reading.pos, reading);
      }
      byWord.set(key, roles);
    }
    return cards.map(card => {
      const own = card.pronunciations?.find(variant => variant.pos === card.pos) || defaultAudio(card);
      const sounds = new Set([soundKey(own.ipa)]);
      const alternatives = [];
      for (const reading of byWord.get(wordKey(card.word)).values()) {
        const sound = soundKey(reading.ipa);
        if (reading.pos === own.pos || sounds.has(sound)) continue;
        sounds.add(sound);
        alternatives.push(reading);
      }
      return alternatives.length ? { ...card, pronunciations: [own, ...alternatives] } : card;
    });
  }

  function id(book, unit, track) {
    return "B" + String(book).padStart(2, "0") + "-" + track + "-U" + String(unit).padStart(2, "0");
  }

  function siteMedia(file) {
    if (!/^media\/(?:word|example|picture)\/[a-z0-9-]+\.(?:mp3|webp)$/.test(file)) {
      throw new Error("Unexpected vocabulary media path");
    }
    return window.UNLOCK_VOCABULARY_LIVE_MEDIA[file] || "assets/unlock-vocabulary/" + file;
  }

  function media(file) {
    return new URL(siteMedia(file), new URL("../../", root)).href;
  }

  const roleAbbreviations = new Map([
    ["名词", "n."], ["动词", "v."], ["形容词", "adj."], ["副词", "adv."], ["介词", "prep."],
    ["复数名词", "n. pl."], ["名词短语", "n. phr."], ["形容词短语", "adj. phr."],
    ["副词短语", "adv. phr."], ["短语动词", "phr. v."], ["短语", "phr."], ["习语", "idm."],
  ]);

  function abbreviateMeaning(option) {
    return option.split("\n").map(line => {
      const match = /^(.+)（([^（）]+)）$/u.exec(line);
      if (!match) return line;
      const [, gloss, roles] = match;
      const labels = roles.split("、").map(role => roleAbbreviations.get(role));
      return labels.every(Boolean) ? labels.join(" / ") + " " + gloss : line;
    }).join("\n");
  }

  async function load(key, signal, revision) {
    const expected = entry(key, revision);
    if (!expected) throw new Error("Unknown vocabulary wordlist");
    const response = await fetch(new URL(expected.file, root), { signal });
    if (!response.ok) throw new Error("Cannot load vocabulary wordlist");
    const bank = await response.json();
    if (bank.id !== key || bank.book !== expected.book || bank.unit !== expected.unit ||
        bank.track !== expected.track || bank.cards?.length !== expected.count) {
      throw new Error("Vocabulary wordlist did not match the selected unit");
    }
    if (expected !== catalog[key]) {
      return { ...bank, revision: expected.revision };
    }
    const cards = wordPronunciations(bank.cards).map(card => ({
      ...card,
      meaning: { ...card.meaning, options: card.meaning.options.map(abbreviateMeaning) },
    }));
    return { ...bank, cards, revision: expected.revision };
  }

  window.UnlockVocabularyBank = { catalog, entry, id, media, siteMedia, load, playLabel };
})();
