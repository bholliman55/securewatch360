export type {
  AssetType,
  BusinessAsset,
  BusinessCriticality,
  GraphEdge,
  GraphEdgeKind,
  GraphNode,
  GraphNodeKind,
  SourceSystemAttribution,
  VulnerabilityRef,
} from "./asset.schema";
export {
  ASSET_TYPES,
  BUSINESS_CRITICALITY,
  businessAssetSchema,
  graphEdgeSchema,
  graphNodeSchema,
  sourceSystemAttributionSchema,
  vulnerabilityRefSchema,
} from "./asset.schema";

export {
  assetDedupeFingerprint,
  mergeBusinessAssets,
  mergeBusinessAssetsDifferentIds,
  mergeDuplicateAssetGroup,
} from "./assetMerger";

export { AssetRegistry } from "./assetRegistry";

export { AssetRelationshipGraph } from "./assetRelationshipGraph";

export { buildAssetRiskContext, type AssetRiskContext } from "./assetRiskContext";
