# flower_detection.py

from detection_utils import run_yolo_boxes


CONF_FLOWER = 0.30


def detect_flowers(model, pil_img, conf=CONF_FLOWER):
    return run_yolo_boxes(model, pil_img, conf=conf)