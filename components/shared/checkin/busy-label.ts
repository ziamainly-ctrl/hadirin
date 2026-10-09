// The sentence on the dimmed viewfinder while a photo is being sent. Pure: tests/checkin-busy-label.test.ts.

export type BusyStage = 'upload' | 'punch' | null;

/**
 * @param stage    'upload' while the selfie goes up, 'punch' while the attendance call is in flight.
 * @param progress bytes sent so far as 0..1, or null when the browser cannot say.
 * @param noun     "Absen masuk" / "Absen keluar".
 * @returns        undefined when nothing is being sent.
 *
 * At 100 % every byte has left the phone but the server is still storing the file, so "Mengunggah"
 * would be a lie (and read as a frozen screen): it says "Menyimpan" instead.
 */
export function describeBusy(stage: BusyStage, progress: number | null, noun: string): string | undefined {
  if (stage === 'upload') return progress !== null && progress >= 1 ? 'Menyimpan foto...' : 'Mengunggah foto...';
  if (stage === 'punch') return `Mencatat ${noun.toLowerCase()}...`;
  return undefined;
}
