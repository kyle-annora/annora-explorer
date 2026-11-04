# Prepared presentation media

These optional records attach matching derivative media to an already prepared
model and its exact authored tour. The main Explorer owns playback and rendering.
This directory does not contain another live Showcase application or an export API.

`registry.json` defines exact model package revision, tour identity, source credit, pinned source data and
five media roles: film, GIF, whole assembly, exploded layers and technical detail.
The build validates enabled records and imports media only for model/tour pairs
included in `project.config.json`. Removing a robot from that configuration also
excludes its presentation media from a customer build.
Changing its package while retaining old media fails the build until the matching
presentation set is reviewed and its explicit revision is updated.

`provenance.json` records exact source-package and media hashes from
[Showcase release 3005c25](https://github.com/kyle-annora/annora-duck-showcase/tree/3005c25a040c488397c1f487a507aa3b7b6827fb).
All prepared model bytes are preserved. The original source material, offline
preparation scripts, source-to-display mappings and validation reports remain in
that pinned public model lab:

| Model | Original source pin | Reproduction and evidence |
| --- | --- | --- |
| Open Duck Mini v2 | Viewer distribution `dfdb84ef3ae2405e5f115b32f48471331dc65d78`, Apache-2.0 | [Preparation](https://github.com/kyle-annora/annora-duck-showcase/tree/3005c25a040c488397c1f487a507aa3b7b6827fb/examples/open-duck) |
| Hexapod | Hardware `f8ee8084d48470283d5ca23394d5a4b9590ad9e8`, CERN-OHL-W-2.0 | [Preparation and modified source](https://github.com/kyle-annora/annora-duck-showcase/tree/3005c25a040c488397c1f487a507aa3b7b6827fb/examples/hexapod) |
| Dropbear | URDF `9bac53d0dee196c62620eee9e8a0fa255a0ff5fa`, MIT | [Preparation](https://github.com/kyle-annora/annora-duck-showcase/tree/3005c25a040c488397c1f487a507aa3b7b6827fb/examples/dropbear) |

The prepared packages retain full licenses; builds include `LICENSES.txt`, linked
from the media page. Hexapod's notice retains its public modified Source Location.
The large raw robot source and full-resolution WebM masters are not duplicated
into this reusable starter. They remain available at the pinned source above.

Hexapod's revision-matched record also opts into the [three-chapter orbital guide](../../docs/hexapod-orbital-guide.md).
This presentation attachment does not change the source model, its revision, or references saved by other applications.

Each film is silent, 960 × 600, 30 fps and 20 seconds. Films and keyframes come
from the same prepared model/tour. The illustrative motion and separation do not
establish physical balance, collision clearance, a closed-chain solution or
manufacturing validity. The media page opens the matching timeline in the main
Explorer. For Hexapod it includes `guide=timeline` so the link still opens the
sequence used to create the film.
