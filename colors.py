# %%
import pandas as pd
import numpy as np
import json
import random
import colorsys
from IPython.display import display, HTML
import matplotlib.pyplot as plt
import matplotlib.pylab as pylab
import seaborn as sns
# %%
with open('colors.json', 'r', encoding='utf8') as f:
    colors = json.load(f)
colors
# %%
len(colors)
# %%
sns.palettes.color_palette([i['hex'] for i in colors[:9]])
# %%
def _get_color_family(color):
    if len(color) != 3 or any(not 0 <= value <= 255 for value in color):
        raise ValueError('颜色必须是由 3 个 0～255 数值组成的 RGB 序列')

    color_hex = '#{:02x}{:02x}{:02x}'.format(*color)
    hue, saturation, value = colorsys.rgb_to_hsv(
        color[0] / 255,
        color[1] / 255,
        color[2] / 255,
    )
    hue *= 360

    # 低饱和度颜色先按明度归入无彩色系
    if value <= 0.15:
        color_family = '黑色系'
    elif saturation <= 0.12:
        color_family = '白色系' if value >= 0.9 else '灰色系'
    elif (hue >= 330 or hue < 15) and saturation <= 0.65 and value >= 0.65:
        color_family = '粉色系'
    elif 15 <= hue < 45 and value < 0.65:
        color_family = '棕色系'
    elif hue >= 345 or hue < 15:
        color_family = '红色系'
    elif hue < 45:
        color_family = '橙色系'
    elif hue < 70:
        color_family = '黄色系'
    elif hue < 165:
        color_family = '绿色系'
    elif hue < 195:
        color_family = '青色系'
    elif hue < 255:
        color_family = '蓝色系'
    elif hue < 290:
        color_family = '紫色系'
    elif hue < 345:
        color_family = '品红色系'
    else:
        color_family = '红色系'

    return color_hex, color_family


def color_sys(color_list):
    is_single_color = (
        isinstance(color_list, (list, tuple, np.ndarray))
        and len(color_list) == 3
        and all(isinstance(value, (int, np.integer)) for value in color_list)
    )
    colors_to_check = [color_list] if is_single_color else color_list

    if not isinstance(colors_to_check, (list, tuple, np.ndarray)) or len(colors_to_check) == 0:
        raise ValueError('请输入一个 RGB 颜色，或由多个 RGB 颜色组成的非空列表')

    results = [_get_color_family(color) for color in colors_to_check]
    color_blocks = ''.join(
        f'<span style="display:inline-flex;flex-direction:column;align-items:center;'
        f'margin:0 8px 8px 0;">'
        f'<span style="display:block;width:60px;height:60px;background:{color_hex};'
        f'border:1px solid #999;"></span>'
        f'<span style="margin-top:4px;font-size:12px;">{color_family}</span>'
        f'</span>'
        for color_hex, color_family in results
    )
    display(HTML(color_blocks))

    color_families = [color_family for _, color_family in results]
    return color_families[0] if is_single_color else color_families
# %%
random_colors = random.sample(colors, 10)
color_sys([color['RGB'] for color in random_colors])
# color_sys([color['RGB'] for color in colors[:10]])
# %%
[color['RGB'] for color in colors[:10]]
# %%
