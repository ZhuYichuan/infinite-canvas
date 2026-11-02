# Infinite Canvas Domain Model

Canvas-based multimodal generation and node workflow editor.

## Canvas Spatial Layers

**Node Card**:
The visual, world-space representation of a node on the infinite canvas that scales with viewport zoom (`scale(k)`).
_Avoid_: Node Box, Node Container, Node Body

**Node Inspector Overlay**:
The screen-space interactive surface (prompt composer, generation configuration, reference manager) anchored to an active canvas node at a fixed 1:1 scale.
_Avoid_: Node Dialog, Bottom Bar, Input Box

**Node Hover Toolbar**:
The screen-space quick action bar floating above a hovered or selected node at a fixed 1:1 scale.
_Avoid_: Action Bar, Header Bar

**Node Create Menu**:
The screen-space contextual picker menu triggered by double-clicking the canvas background or extending a connection handle, rendered at a fixed 1:1 scale.
_Avoid_: Node Selector, Add Node Popup, Double Click Menu

## Task Lifecycle & Execution

**Generation Settlement**:
The outcome of one canvas generation attempt across its result Node Card, its image or text candidates, and its originating configuration. Completed resources remain available when other candidates or a later attempt fail.
_Avoid_: Node finalization, batch completion, generation cleanup

**TaskLifecycleDriver**:
The provider-specific adapter at the task lifecycle seam responsible for querying, polling, and aborting tasks on a specific backend protocol (e.g. ComfyUI, external HTTP, in-memory test driver).
_Avoid_: TaskPoller, JobHandler, BackendService

**TaskSnapshot**:
The universal domain value object describing the point-in-time lifecycle status of a task across all backend providers (phase, queue position, progress, error, artifacts).
_Avoid_: JobResult, StatusResponse, TaskPayload

**TaskExecutionError**:
The normalized domain exception representing task failure with standardized categories (`network`, `timeout`, `cancelled`, `lost`, `execution_failed`), decoupling callers from vendor-specific error prototypes.
_Avoid_: ComfyuiError, VendorException, ApiError

## Multimodal Workflow Model DSL

**WorkflowModelProfile**:
The declarative capability profile defining a generation model's parameters, resource references, slot mappings, and hardware constraints, driving node inspectors and execution dispatchers.
_Avoid_: ModelConfig, WorkflowConfig, ModelDefinition

**AudioModelPicker**:
The cascading model selector in the Audio Node Inspector Overlay that binds a compute host to a declarative audio model profile (e.g. MiniMax Music 03).
_Avoid_: AudioWorkflowPicker, ChannelWorkflowPicker

## System Preset Assets

**System Preset Asset**:
A platform-provided, read-only reference asset (pose, outfit, hairstyle) distributed over a public CDN, usable as a generation reference but never owned or edited by the user.
_Avoid_: Built-in asset, official asset, template library

**Preset Category**:
The mutually exclusive class of a System Preset Asset — `pose`, `costume`, or `portrait`. Different categories have different metadata, filters, and CDN path conventions.
_Avoid_: Preset type, asset kind, gallery tab

**Preset Series**:
A curated grouping inside one Preset Category (e.g. "全身独奏·标准类型", "春", "面部·短发") that the user browses as a unit; every asset belongs to exactly one series.
_Avoid_: Collection, album, set

**Preset Rendition**:
An alternative visual channel of the *same* asset identity — line art vs depth map for poses. Renditions share the id namespace, so switching rendition never changes which asset the user is looking at.
_Avoid_: Pose variant, image type, style variant

**Preset Tier**:
The resolution class requested for a preset image — `thumb` for browsing grids, `mid` for previews, `full` for insertion into a node and submission as a generation reference.
_Avoid_: Image size, quality level

**Sensitive Preset**:
A preset asset whose series is flagged as sensitive (duo interaction, lingerie, swimwear) and therefore hidden from browsing until the user opts in. Carried as data on the series, not as a hardcoded block list.
_Avoid_: NSFW list, blocked series, blacklist

**My Asset**:
A user-owned asset stored in the local asset store, in contrast to a System Preset Asset. Both can be inserted into a node, but only My Assets can be edited or removed.
_Avoid_: User asset, uploaded asset
