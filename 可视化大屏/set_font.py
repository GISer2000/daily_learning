# set_font.py
from matplotlib.font_manager import FontProperties
from matplotlib import font_manager
from matplotlib import rcParams

def set_chinese_font(font_path):
    font_manager.fontManager.addfont(font_path)
    prop = font_manager.FontProperties(fname=font_path)
    rcParams['font.family'] = 'sans-serif'
    rcParams['font.sans-serif'] = prop.get_name()
    rcParams['axes.unicode_minus'] = False

# # if __name__ == "__main__":
#     # Provide the path to your font file
#     custom_font_path = '../Times_SimSun.ttf'
#     set_font(custom_font_path)