import torch
import torchvision
from torchvision.models.detection.faster_rcnn import FastRCNNPredictor


def load_faster_rcnn(model_path: str, device: torch.device):
    # Same architecture as training
    model = torchvision.models.detection.fasterrcnn_resnet50_fpn(weights=None)

    # background(0) + cucumber(1)
    num_classes = 2
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, num_classes)

    state = torch.load(model_path, map_location=device)
    model.load_state_dict(state)

    model.to(device)
    model.eval()
    return model
