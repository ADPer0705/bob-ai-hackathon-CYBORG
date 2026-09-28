from __future__ import annotations
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class ArtifactRequirement(BaseModel):
    type: str
    params: Dict[str, Any] = Field(default_factory=dict)


class OutputSchema(BaseModel):
    format: str = "json"
    schema_: Dict[str, str] = Field(default_factory=dict, alias="schema")


class Weights(BaseModel):
    """Weight provenance for one detector (mirrors the `weights:` block)."""
    file: str = ""
    kind: str = "official"  # official | backbone | external | random
    url: str = ""
    size: int | None = None
    md5: str = ""
    note: str = ""

    @property
    def self_contained(self) -> bool:
        """True when no local checkpoint file is required (weights are either
        downloaded at first run or the model is randomly initialized)."""
        return self.kind in ("external", "random")


class DetectorCapabilities(BaseModel):
    """What kinds of media a detector can consume.

    Derived from ``artifacts.required`` in the detector definition:
      - ``video``      -> video detectors: need a video, analyze faces temporally
      - ``face_crop``  -> frame detectors: analyze faces in images and videos
      - ``audio``      -> audio detectors (none shipped yet)
    """
    media_types: List[str] = Field(default_factory=list)  # subset of image|video|audio
    faces_required: bool = False

    def accepts(self, media_type: str) -> bool:
        return media_type in self.media_types


class DetectorDefinition(BaseModel):
    detector_id: str
    name: str = ""
    version: str
    description: str = ""
    artifacts: Dict[str, List[ArtifactRequirement]] = Field(default_factory=dict)
    output: OutputSchema = Field(default_factory=OutputSchema)
    weights: Weights = Field(default_factory=Weights)
    video_mode: bool = False
    clip_size: Optional[int] = None
    sample_interval: int = 1
    min_face: int = 30
    cam: bool = True
    resolution: int = 256

    @property
    def capabilities(self) -> DetectorCapabilities:
        required = {r.type for r in self.artifacts.get("required", [])}
        # Every shipped detector is face-based; a `video` requirement means
        # temporal face analysis, `face_crop` means per-frame face analysis.
        faces_required = bool(required & {"video", "face_crop", "face"})
        if "audio" in required:
            media_types = ["audio"]
            faces_required = False
        elif "video" in required:
            media_types = ["video"]
        elif faces_required or required & {"image", "frame"}:
            media_types = ["image", "video"]
        else:
            media_types = ["image", "video", "audio"]
        return DetectorCapabilities(media_types=media_types, faces_required=faces_required)
