/**
 * Recording a note instead of typing it.
 *
 * The clip never passes through our API. The browser records it, asks the
 * server for a short-lived signature, uploads straight to the storage
 * provider, and sends back only the resulting URL — the same route an avatar
 * takes, and for the same reason: the JSON body limit is 1MB, and raising it
 * for one endpoint raises it for every endpoint.
 *
 * Three things have to be true before the button is worth showing, and all
 * three are checked rather than assumed: the browser has `MediaRecorder`, the
 * server has storage configured, and the user grants the microphone. The first
 * two hide the button; the third can only be asked at the moment of recording,
 * so it is reported in the dialog.
 */
import { useEffect, useRef, useState } from 'react';
import { AudioPlayer } from '../components/ui/AudioPlayer';
import { Button } from '../components/ui/Button';
import { Field } from '../components/ui/Field';
import { Icon } from '../components/ui/Icon';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ApiError, notes as notesApi } from '../lib/api';
import { clock } from '../lib/format';
import { noteHooks } from '../lib/queries';

/** Whether this browser can record at all. Firefox and Chrome can; older
 *  Safari cannot, and a button that throws on tap is worse than no button. */
function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.MediaRecorder !== 'undefined' &&
    navigator.mediaDevices?.getUserMedia !== undefined
  );
}

type Stage = 'idle' | 'recording' | 'recorded' | 'saving';

export function VoiceNoteButton() {
  const toast = useToast();
  const create = noteHooks.useCreate();

  const [supported] = useState(canRecord);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);

  // Storage is optional on the server. Asked once, not per click.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;

    void notesApi
      .voiceConfig()
      .then((r) => !cancelled && setEnabled(r.voiceNotesEnabled))
      .catch(() => !cancelled && setEnabled(false));

    return () => {
      cancelled = true;
    };
  }, [supported]);

  if (!supported || enabled !== true) return null;

  return (
    <>
      <Button variant="secondary" size="sm" icon="mic" onClick={() => setOpen(true)}>
        Add voice note
      </Button>

      {/* Mounted only while open, so each recording starts from nothing —
          no stream left running, no clip from last time still loaded. */}
      {open ? (
        <VoiceNoteDialog
          onClose={() => setOpen(false)}
          saving={create.isPending}
          onSave={async (title, blob, seconds) => {
            try {
              const signature = await notesApi.voiceSignature();

              const form = new FormData();
              form.append('file', blob, 'voice-note.webm');
              form.append('api_key', signature.apiKey);
              form.append('timestamp', String(signature.timestamp));
              form.append('signature', signature.signature);
              form.append('folder', signature.folder);
              if (signature.publicId) form.append('public_id', signature.publicId);

              const response = await fetch(signature.uploadUrl, { method: 'POST', body: form });
              if (!response.ok) throw new Error('The recording could not be uploaded.');

              const uploaded = (await response.json()) as { secure_url?: string };
              if (!uploaded.secure_url) throw new Error('The upload returned no address.');

              await create.mutateAsync({
                title,
                audioUrl: uploaded.secure_url,
                audioSeconds: seconds,
              });

              toast.success('Voice note saved');
              setOpen(false);
            } catch (error) {
              toast.error(
                error instanceof ApiError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : 'Could not save that recording.',
              );
            }
          }}
        />
      ) : null}
    </>
  );
}

function VoiceNoteDialog({
  onClose,
  onSave,
  saving,
}: {
  onClose: () => void;
  onSave: (title: string, blob: Blob, seconds: number) => Promise<void>;
  saving: boolean;
}) {
  const [stage, setStage] = useState<Stage>('idle');
  const [seconds, setSeconds] = useState(0);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [clip, setClip] = useState<{ blob: Blob; url: string } | null>(null);

  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  /**
   * Stop the microphone.
   *
   * Every track, explicitly. Letting the `MediaRecorder` go out of scope does
   * not release the device — the browser keeps showing its recording
   * indicator, which is alarming and fair enough.
   */
  function releaseMicrophone() {
    recorder.current?.stream.getTracks().forEach((track) => track.stop());
    recorder.current = null;
  }

  // Whatever route the dialog closes by — save, cancel, Escape — the device is
  // released and the object URL is revoked.
  useEffect(() => {
    return () => {
      releaseMicrophone();
      if (clip) URL.revokeObjectURL(clip.url);
    };
  }, [clip]);

  // The running time. A recorder with no clock gives no sense of how long you
  // have been talking.
  useEffect(() => {
    if (stage !== 'recording') return;
    const timer = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const media = new MediaRecorder(stream);
      chunks.current = [];

      media.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.current.push(event.data);
      };

      media.onstop = () => {
        const blob = new Blob(chunks.current, { type: media.mimeType || 'audio/webm' });
        setClip({ blob, url: URL.createObjectURL(blob) });
        setStage('recorded');
      };

      recorder.current = media;
      setSeconds(0);
      setClip(null);
      media.start();
      setStage('recording');
    } catch {
      // Refusing the microphone is a decision, not a fault. It reads as one.
      setError('Skrivbok needs permission to use your microphone to record a note.');
      setStage('idle');
    }
  }

  function stop() {
    recorder.current?.stop();
    releaseMicrophone();
  }

  function discard() {
    if (clip) URL.revokeObjectURL(clip.url);
    setClip(null);
    setSeconds(0);
    setStage('idle');
  }

  const busy = saving || stage === 'saving';
  const ready = clip !== null && title.trim() !== '';

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="Add voice note"
      description="Record it now, and give it a title so you can find it later."
      busy={busy}
      footer={
        <>
          <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon="check"
            loading={busy}
            disabled={!ready}
            onClick={() => {
              if (!clip) return;
              setStage('saving');
              void onSave(title.trim(), clip.blob, seconds).finally(() => setStage('recorded'));
            }}
          >
            Save note
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface-5 px-4 py-7">
          {stage === 'recording' ? (
            <button
              type="button"
              onClick={stop}
              aria-label="Stop recording"
              className="grid size-20 place-items-center rounded-full bg-danger text-white transition hover:brightness-95"
            >
              <Icon name="stop" size={34} />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void start()}
              disabled={busy}
              aria-label={clip ? 'Record again' : 'Start recording'}
              className="press grid size-20 place-items-center rounded-full bg-brand-deep text-white transition hover:brightness-110 disabled:opacity-50"
            >
              <Icon name={clip ? 'refresh' : 'mic'} size={34} />
            </button>
          )}

          <p className="font-mono text-[22px] leading-none font-bold tabular">{clock(seconds)}</p>

          <p className="text-[13px] text-ink-3">
            {stage === 'recording'
              ? 'Recording — tap to stop'
              : clip
                ? 'Tap to record again'
                : 'Tap to start recording'}
          </p>

          {/* The clip is playable before it is saved: nobody should have to
              commit a recording they have not heard. The length comes from the
              recorder's own clock — a WebM stream carries no duration of its
              own, so the file cannot be asked. */}
          {clip && stage !== 'recording' ? (
            <AudioPlayer src={clip.url} seconds={seconds} className="mt-1 w-full max-w-[320px]" />
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="text-[13px] leading-relaxed text-danger-ink">
            {error}
          </p>
        ) : null}

        <Field
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What is this about?"
          required
          hint={
            clip && title.trim() === '' ? 'A title is needed before this can be saved.' : undefined
          }
        />

        {clip ? (
          <button
            type="button"
            onClick={discard}
            disabled={busy}
            className="self-start text-[12.5px] font-semibold text-ink-3 underline transition hover:text-ink"
          >
            Discard this recording
          </button>
        ) : null}
      </div>
    </Modal>
  );
}
