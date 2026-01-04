import torch
import torchvision
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor


def load_faster_rcnn(model_path: str, device: torch.device):
    # Load checkpoint first to check num_classes
    checkpoint = torch.load(model_path, map_location=device)
    
    # Get num_classes from checkpoint if available
    if isinstance(checkpoint, dict) and "num_classes" in checkpoint:
        num_classes = checkpoint["num_classes"]
    else:
        # Default: background(0) + cucumber(1)
        num_classes = 2
    
    # Same architecture as training
    model = torchvision.models.detection.fasterrcnn_resnet50_fpn(weights=None)

    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)

    # Handle different checkpoint formats
    if isinstance(checkpoint, dict) and "model_state" in checkpoint:
        # Checkpoint contains metadata
        model.load_state_dict(checkpoint["model_state"])
    else:
        # Checkpoint is just the state dict
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()
    return model
