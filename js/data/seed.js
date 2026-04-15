/**
 * Datos de ejemplo / estado inicial para la app de Bienestar.
 * Se usa en store.restoreSeedData() como punto de partida visual.
 * Los perfiles reales viven en Firestore — estos son solo para pruebas locales.
 */
export const SEED_DATA = {
  profiles: [
    {
      id: "profile-alek",
      name: "Alek",
      shortGoal: "Seguimiento general de salud"
    },
    {
      id: "profile-cata",
      name: "Cata",
      shortGoal: "Seguimiento general de salud"
    }
  ],
  bodyStatusEntries: [],
  symptoms: [],
  appointments: [],
  checkups: [],
  treatments: [],
  notes: []
};
