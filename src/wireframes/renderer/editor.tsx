import * as React from 'react';
import { connect } from 'react-redux';
import { bindActionCreators, Dispatch } from 'redux';
import * as svg from 'svg.js';

import './editor.scss';

import { ImmutableList, sizeInPx } from '@app/core';

import {
    changeItemsAppearance,
    Diagram,
    DiagramGroup,
    DiagramItem,
    DiagramShape,
    DiagramVisual,
    EditorStateInStore,
    getSelection,
    Renderer,
    RendererService,
    selectItems,
    Transform,
    transformItems,
    UIStateInStore
} from '@app/wireframes/model';

import { CanvasView } from './canvas-view';

export interface EditorProps {
    // The renderer service.
    rendererService: RendererService;

    // The selected diagram.
    selectedDiagram: Diagram;

    // The selected items.
    selectedItems: DiagramItem[];

    // The width of the canvas.
    zoomedWidth: number;

    // The height of the canvas.
    zoomedHeight: number;

    // The zoom value of the canvas.
    zoom: number;

    // A function to select a set of items.
    selectItems: (diagram: Diagram, itemIds: string[]) => any;

    // A function to change the appearance of a visual.
    changeItemsAppearance: (diagram: Diagram, visuals: DiagramVisual[], key: string, val: any) => any;

    // A function to transform a set of items.
    transformItems: (diagram: Diagram, items: DiagramItem[], oldBounds: Transform, newBounds: Transform) => any;
}

const mapStateToProps = (state: UIStateInStore & EditorStateInStore) => {
    const { editor, diagram, items} = getSelection(state);

    return {
        selectedDiagram: diagram,
        selectedItems: items,
        zoomedWidth: editor.size.x * state.ui.zoom,
        zoomedHeight: editor.size.y * state.ui.zoom,
        zoom: state.ui.zoom
    };
};

const mapDispatchToProps = (dispatch: Dispatch<any>) => bindActionCreators({
    selectItems, changeItemsAppearance, transformItems
}, dispatch);

const isProduction = process.env.NODE_ENV === 'production';

class Editor extends React.Component<EditorProps> {
    private diagramDoc: svg.Doc;
    // private interactionService: InteractionService = new InteractionService();
    private shapeRefsById: { [id: string]: ShapeRef } = {};
    private shapeRefsByRenderElement: { [id: number]: ShapeRef } = {};

    public componentDidUpdate() {
        this.renderDiagram();
    }

    public initDiagramScope(doc: svg.Doc) {
        this.diagramDoc = doc;

        this.renderDiagram();

        this.forceUpdate();
    }

    private renderDiagram() {
        if (!this.diagramDoc) {
            return;
        }

        const allShapesById: { [id: string]: boolean } = {};
        const allShapes = this.getFlattenShapes();

        allShapes.forEach(item => allShapesById[item.id] = true);

        for (let id in this.shapeRefsById) {
            if (this.shapeRefsById.hasOwnProperty(id)) {
                const ref = this.shapeRefsById[id];

                ref.remove();

                if (!allShapesById[id]) {
                    delete this.shapeRefsById[id];
                    delete this.shapeRefsByRenderElement[ref.renderId];
                }
            }
        }

        for (let shape of allShapes) {
            let ref = this.shapeRefsById[shape.id];

            if (!ref) {
                const renderer = this.props.rendererService.registeredRenderers[shape.renderer];

                ref = new ShapeRef(this.diagramDoc, renderer, !isProduction);
            }

            ref.render(shape);

            this.shapeRefsByRenderElement[ref.renderId] = ref;
            this.shapeRefsById[shape.id] = ref;
        }
    }

    private getFlattenShapes() {
        const flattenShapes: DiagramShape[] = [];

        const diagram = this.props.selectedDiagram;

        if (diagram) {
            let handleContainer: (itemIds: ImmutableList<string>) => any;

            handleContainer = itemIds => {
                itemIds.forEach(itemId => {
                    const item = diagram.items.get(itemId);

                    if (item) {
                        if (item instanceof DiagramShape) {
                            flattenShapes.push(item);
                        }

                        if (item instanceof DiagramGroup) {
                            handleContainer(item.childIds);
                        }
                    }
                });
            };

            handleContainer(diagram.rootIds);
        }

        return flattenShapes;
    }

    /*
    private provideItemByElement = (item: paper.Item): DiagramItem | null => {
        const ref = this.shapeRefsByRenderElement[item.id];

        return ref ? ref.shape : null;
    }
    */

    public render() {
        return (
            <div className='editor' style={{ width: sizeInPx(this.props.zoomedWidth), height: sizeInPx(this.props.zoomedHeight) }}>
                <div>
                    <CanvasView onInit={(doc) => this.initDiagramScope(doc)}
                        zoom={this.props.zoom}
                        zoomedWidth={this.props.zoomedWidth}
                        zoomedHeight={this.props.zoomedHeight} />
                </div>
            </div>
        );
    }
}

class ShapeRef {
    private shape: DiagramShape;

    public renderedElement: svg.Element;

    public get renderId() {
        return this.renderedElement.id();
    }

    constructor(
        public readonly doc: svg.Doc,
        public renderer: Renderer,
        public showDebugMarkers: boolean
    ) {
    }

    public remove() {
        if (this.renderedElement) {
            this.renderedElement.remove();
        }
    }

    public render(shape: DiagramShape) {
        const mustRender = this.shape !== shape || !this.renderedElement;

        if (mustRender) {
            this.renderer.setContext(this.doc);

            this.renderedElement = this.renderer.render(shape, this.showDebugMarkers);
        } else {
            this.doc.add(this.renderedElement);
        }

        this.shape = shape;
    }
}

export const EditorContainer = connect(
    mapStateToProps,
    mapDispatchToProps
)(Editor);