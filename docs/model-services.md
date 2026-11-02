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
repeat discovery. No model catalog or voice list is maintained in this fork.

| Task | Native owner and address |
| --- | --- |
| Story replies | Custom OpenAI-compatible chat, server `/v1` base |
| Optional image writer | Independent Connection Manager profile using chat `/v1` |
| Images | Stable-diffusion.cpp, server root without `/v1` |
| Voice narration | OpenAI Compatible TTS, `/v1/audio/speech` |
| Dictation | Compatible transcription, `/v1/audio/transcriptions` |

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
