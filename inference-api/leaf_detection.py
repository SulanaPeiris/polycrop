# leaf_detection.py

from detection_utils import run_yolo_boxes


CONF_LEAF = 0.25


def detect_leaves(model, pil_img, conf=CONF_LEAF):
    return run_yolo_boxes(model, pil_img, conf=conf)