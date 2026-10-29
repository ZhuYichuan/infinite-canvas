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

**TaskLifecycleDriver**:
The provider-specific adapter at the task lifecycle seam responsible for querying, polling, and aborting tasks on a specific backend protocol (e.g. ComfyUI, external HTTP, in-memory test driver).
_Avoid_: TaskPoller, JobHandler, BackendService

**TaskSnapshot**:
The universal domain value object describing the point-in-time lifecycle status of a task across all backend providers (phase, queue position, progress, error, artifacts).
_Avoid_: JobResult, StatusResponse, TaskPayload

**TaskExecutionError**:
The normalized domain exception representing task failure with standardized categories (`network`, `timeout`, `cancelled`, `lost`, `execution_failed`), decoupling callers from vendor-specific error prototypes.
_Avoid_: ComfyuiError, VendorException, ApiError
