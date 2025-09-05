import math
import geopandas as gpd
from shapely.geometry import Polygon

def plotscale(ax, bounds, textcolor='k', textsize=8, compasssize=1, crs_is_projected=True,
              accuracy='auto', rect=[0.1, 0.1], unit="KM", style=1, **kwargs):
    '''
    Add compass and scale for a map

    Parameters
    -------
    bounds : List
        The drawing boundary of the base map, [lon1,lat1,lon2,lat2]
        (WGS84 coordinate system), where lon1 and lat1 are the coordinates
        of the lower left corner and lon2 and lat2 are the coordinates of
        the upper right corner
    textsize : number
        size of the text
    compasssize : number
        size of the compass
    accuracy : number
        Length of scale bar (m)
    unit : str
        ‘KM’,’km’,’M’,’m’, the scale units
    style : number
        1 or 2, the style of the scale
    rect : List
        The approximate position of the scale bar in the figure, such as
        [0.9,0.9], is in the upper right corner
    '''

    lon1 = bounds[0]
    lat1 = bounds[1]
    lon2 = bounds[2]
    lat2 = bounds[3]
    if accuracy == 'auto':
        accuracy = (int((lon2-lon1)/0.0003/1000+0.5)*1000)  # pragma: no cover
    a, c = rect
    b = 1-a
    d = 1-c
    alon, alat = (b*lon1+a*lon2)/(a+b), (d*lat1+c*lat2)/(c+d)
    if crs_is_projected:
        deltaLon = accuracy
    else:
        deltaLon = accuracy * 360 / \
            (2 * math.pi * 6371004 * math.cos((lat1 + lat2) * math.pi / 360))
    
    # add scale
    if style == 1:
        scale = gpd.GeoDataFrame({
            'color': [(0, 0, 0), (1, 1, 1), (0, 0, 0), (1, 1, 1)],
            'geometry':
            [Polygon([
                (alon, alat),
                (alon+deltaLon, alat),
                (alon+deltaLon, alat+deltaLon*0.4),
                (alon, alat+deltaLon*0.4)]),
             Polygon([
                 (alon+deltaLon, alat),
                 (alon+2*deltaLon, alat),
                 (alon+2 * deltaLon, alat+deltaLon*0.4),
                 (alon+deltaLon, alat+deltaLon*0.4)]),
             Polygon([
                 (alon+2*deltaLon, alat),
                 (alon+4*deltaLon, alat),
                 (alon+4 * deltaLon, alat+deltaLon*0.4),
                 (alon+2*deltaLon, alat+deltaLon*0.4)]),
             Polygon([
                 (alon+4*deltaLon, alat),
                 (alon+8*deltaLon, alat),
                 (alon+8 * deltaLon, alat+deltaLon*0.4),
                 (alon+4*deltaLon, alat+deltaLon*0.4)])
             ]})
        scale.plot(ax=ax, edgecolor=textcolor,
                   facecolor=scale['color'], lw=0.6, **kwargs)
        if (unit == 'KM') | (unit == 'km'):
            ax.text(alon+1*deltaLon, alat+deltaLon*0.5,
                    str(int(1*accuracy/1000)), color=textcolor,
                    fontsize=textsize, ha='center', va='bottom')
            ax.text(alon+2*deltaLon, alat+deltaLon*0.5,
                    str(int(2*accuracy/1000)), color=textcolor,
                    fontsize=textsize, ha='center', va='bottom')
            ax.text(alon+4*deltaLon, alat+deltaLon*0.5,
                    str(int(4*accuracy/1000)), color=textcolor,
                    fontsize=textsize, ha='center', va='bottom')
            ax.text(alon+8*deltaLon, alat+deltaLon*0.5,
                    str(int(8*accuracy/1000)), color=textcolor,
                    fontsize=textsize, ha='center', va='bottom')
            ax.text(alon+8.5*deltaLon, alat+deltaLon*0.5, unit,
                    color=textcolor, fontsize=textsize, ha='left',
                    va='top')
        if (unit == 'M') | (unit == 'm'):
            ax.text(alon+1*deltaLon, alat+deltaLon*0.5, str(int(1*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+2*deltaLon, alat+deltaLon*0.5, str(int(2*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+4*deltaLon, alat+deltaLon*0.5, str(int(4*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8*deltaLon, alat+deltaLon*0.5, str(int(8*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8.5*deltaLon, alat+deltaLon*0.5, unit,
                    color=textcolor, fontsize=textsize,
                    ha='left', va='top')
    if style == 2:
        scale = gpd.GeoDataFrame({
            'color': [(0, 0, 0), (1, 1, 1)],
            'geometry':
            [Polygon([(alon, alat),
                      (alon+4*deltaLon, alat),
                      (alon+4*deltaLon, alat+deltaLon*0.4),
                      (alon, alat+deltaLon*0.4)]),
                Polygon([(alon+4*deltaLon, alat),
                         (alon+8*deltaLon, alat),
                         (alon+8 * deltaLon, alat+deltaLon*0.4),
                         (alon+4*deltaLon, alat+deltaLon*0.4)])
             ]})
        scale.plot(ax=ax, edgecolor=textcolor,
                   facecolor=scale['color'], lw=0.6, **kwargs)
        if (unit == 'KM') | (unit == 'km'):
            ax.text(alon+4*deltaLon, alat+deltaLon*0.5,
                    str(int(4*accuracy/1000)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8*deltaLon, alat+deltaLon*0.5,
                    str(int(8*accuracy/1000)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8.5*deltaLon, alat+deltaLon*0.5, unit,
                    color=textcolor, fontsize=textsize,
                    ha='left', va='top')
        if (unit == 'M') | (unit == 'm'):
            ax.text(alon+4*deltaLon, alat+deltaLon*0.5,
                    str(int(4*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8*deltaLon, alat+deltaLon*0.5,
                    str(int(8*accuracy)),
                    color=textcolor, fontsize=textsize,
                    ha='center', va='bottom')
            ax.text(alon+8.5*deltaLon, alat+deltaLon*0.5, unit,
                    color=textcolor, fontsize=textsize,
                    ha='left', va='top')
    # add compass
    deltaLon = compasssize*deltaLon
    alon = alon-deltaLon
    compass = gpd.GeoDataFrame({
        'color': [(0, 0, 0), (1, 1, 1)],
        'geometry': [
            Polygon([[alon, alat],
                     [alon, alat+deltaLon],
                     [alon+1/2*deltaLon, alat-1/2*deltaLon]]),
            Polygon([[alon, alat],
                     [alon, alat+deltaLon],
                     [alon-1/2*deltaLon, alat-1/2*deltaLon]])]})
    compass.plot(ax=ax, edgecolor=textcolor,
                 facecolor=compass['color'], lw=0.6, **kwargs)
    ax.text(alon, alat+deltaLon, 'N', color=textcolor,
            fontsize=textsize, ha='center', va='bottom')