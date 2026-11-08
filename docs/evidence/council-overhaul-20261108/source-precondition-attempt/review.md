# Source fixture preference correction

The frozen runtime run on reused synthetic source 8035 completed 95 passes and 4
failures in 802.156 seconds, with no skipped/flaky cases or page errors. Failed
cases were blocked storage, sibling draft isolation, old reply checkpoints/user
draft reload, and native character rename/drafts. The sibling trace has normal
input events but zero storage writes. A bounded read of this task's synthetic
server settings showed restore_user_input=false. Native saveDraft intentionally
returns before storage when this preference is off.

The fixture had inherited the server preference while asserting restoration was
on. Its initial settings response now explicitly enables that precondition.
Within-case savedSettings remains authoritative, so the opt-out case saves false,
reloads and proves that preference remains respected. No product code changed.
The three initially failing cases plus explicit opt-out passed 4/4 in 31.0 seconds;
native character rename passed 1/1 in 8.4 seconds. Test lint passes with 0 errors and 53
warnings. The quality council reviewed this distinction.

This explains this traced source run only. The original v1.19.22 image failure
was untraced and remains unattributed. Independent controlled failures on v1.19.22 still
establish the rename timing and character collection defects fixed by v1.19.23. Neither
passing repetitions nor this fixture correction erase that release hold.

A new 99-case run starts from five fresh synthetic volumes on 8042 with source
public/src/package/package-lock overlays. It is source proof, not image proof.
Its full result and actual-image acceptance are separate final gates.
