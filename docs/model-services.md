# Connect model services

Open Settings, then Models & connections. Enter the Juiced server root or its
OpenAI `/v1` base and choose Verify & discover. Discovery checks the connection
from the SillyTavern server, so the address must be reachable from its container.

For the current LAN/VPN deployment, enter `https://juiced.swarm.nulteck.com`.
The same-network address `http://juiced:8080` works only when both containers
share that Docker network. A local test container cannot assume that DNS name.

Choose each optional service and click Use selected model. The setup writes the
existing native provider settings. It does not enable or reconfigure models on
Juiced. Disabled models do not appear. Enable them on the model server, then
repeat discovery. Discovery reads models and voices from the server. This fork
does not ship a Juiced model registry.

| Task | Native owner and address |
| --- | --- |
| Story replies | Custom OpenAI-compatible chat, server `/v1` base |
| Optional image writer | Independent Connection Manager profile using chat `/v1` |
| Images | Stable-diffusion.cpp, server root without `/v1` |
| Voice narration | OpenAI Compatible TTS, `/v1/audio/speech` |
| Dictation | Compatible transcription, `/v1/audio/transcriptions` |

### Connected, but the first reply fails

Discovery verifies available services and models; it does not submit a story
prompt. A model can therefore appear connected and still reject the assembled
messages. The error `System message must be at the beginning` means its chat
template rejected a later system instruction. Native post-history instructions
can produce that message order even on the first reply.

Open **Settings > Models & connections**. Under **Custom (OpenAI-compatible)**,
set **Prompt Post-Processing** to **Semi-strict (alternating roles; with tools)**,
then return to the story and retry. This existing native setting retains the
opening system message, converts later system messages to user messages, and
merges adjacent messages with the same role. It preserves their text and order,
but later instructions have user-role priority. It does not change the selected
model, sampling, chat files or server template. Tools remain supported by the
converter; the selected model must also support them.

The exact error and recovery were reproduced with `Qwen3.5-2B` on the published
v1.19.9 image using a neutral first-turn story and a native post-history
instruction. This setting is already available in v1.19.9; no container update
is required. It is an explicit per-configuration choice, not a forced setting
for every model. A preset or Connection Manager profile that loads another
preset can restore its own prompt-processing value; save the compatible value
in that preset if you use it.

### Optional services

Story replies and the image writer are independent selections. Current chat model
is the default writer. A separate writer receives character descriptions,
scenarios and the last eight non-system messages. Descriptions/scenarios are
bounded to 3000 characters each, and each message to 2000. Writer instructions
and maximum output tokens remain editable in Image generation. Direct image
prompts bypass the writer. The compatible writer sends thinking-off through
the native Additional Parameters mechanism.

Review native image size, steps, CFG, sampler and scheduler after selecting an
image model. Setup preserves explicit sampling settings. Juiced's sd.cpp subset
supports txt2img, model discovery and progress. It does not implement img2img,
hires, AUTOMATIC1111 scripts or server-side image saving. This fork uses its
stock image endpoint; no alternate image protocol adapter is required.

Voice discovery lists the voices the selected speech backend actually returns.
Choose a voice before applying the speech connection. Existing character voice
mappings stay saved. Narration remains off until Voice is enabled in the story.
If discovery fails because a model is not loaded, load it on the server and
re-select the model to retry. Other providers retain their native key settings.
The current Juiced LAN runtime needs no key.

Dictation requires HTTPS or localhost and browser microphone permission. Click
Dictate in the composer, speak, then Stop dictation. Recording stops after 60
seconds. Review the inserted transcript before sending. The app never sends it
automatically. A story change cancels pending dictation. Dictation settings also
accepts an audio file smaller than 25 MB and up to 120 seconds. Browser decoding
converts recordings and uploaded audio to mono 16 kHz, 16-bit PCM WAV for all
compatible transcription providers. Endpoint/model controls remain editable
there. Compatible transcription uses the saved Custom OpenAI key when present.

## Existing settings and migration

Existing settings load without a conversion or provider reset. Discovery alone
does not change their native connections. Apply only the services you want to
change. Existing Connection Manager profiles remain saved. Applying the same
writer model/address reuses its profile rather than adding another copy.

The setup stores only the discovery address as a preference. Models, voices,
provider endpoints and generation settings stay with their native owners.
Reloading clears the discovered list. Verify & discover refreshes it from the
server and restores selections that are still available.

Generic OpenAI-compatible servers can use chat-model discovery. Servers that do
not advertise Juiced service discovery keep their native image/audio settings.
Connection and capability failures appear beside the affected control with a
retry instruction. Provider keys are managed by the existing native controls.

No cache policy changes are made. Ornith Persistent snapshots are qualified only
for Chat Completions with stable `X-Juiced-Session-Id`. This setup does not add
that header or claim persistent cache support for every protocol. Native Custom
OpenAI Additional Parameters retains header configuration for users who need it.

## Deployment boundary

The release handoff in container-releases.md owns immutable image references,
verification and rollback. Homelab owns the later production update. Preserve
all production volume identities. Never use production data for browser tests.
